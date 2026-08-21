'use strict';

/**
 * Appwrite-compatible Query class + translator to PostgreSQL SQL.
 *
 * Mirrors node-appwrite's Query API (each static method returns a JSON string),
 * and translates those query strings into SQL WHERE / ORDER BY / LIMIT / OFFSET.
 */

const ATTRIBUTE_MAP = {
    $id: 'id',
    $createdAt: 'created_at',
    $updatedAt: 'updated_at'
};

function mapAttribute(attr) {
    if (Object.prototype.hasOwnProperty.call(ATTRIBUTE_MAP, attr)) {
        return ATTRIBUTE_MAP[attr];
    }
    if (typeof attr !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(attr)) {
        throw new Error(`Invalid attribute name: ${attr}`);
    }
    return attr;
}

function escapeLike(value) {
    return String(value).replace(/[\\%_]/g, (m) => '\\' + m);
}

class Query {
    constructor(method, attribute, values) {
        this.method = method;
        this.attribute = attribute;
        if (values !== undefined) {
            this.values = Array.isArray(values) ? values : [values];
        }
    }
    toString() {
        return JSON.stringify({ method: this.method, attribute: this.attribute, values: this.values });
    }
}

Query.equal = (attribute, value) => new Query('equal', attribute, value).toString();
Query.notEqual = (attribute, value) => new Query('notEqual', attribute, value).toString();
Query.lessThan = (attribute, value) => new Query('lessThan', attribute, value).toString();
Query.lessThanEqual = (attribute, value) => new Query('lessThanEqual', attribute, value).toString();
Query.greaterThan = (attribute, value) => new Query('greaterThan', attribute, value).toString();
Query.greaterThanEqual = (attribute, value) => new Query('greaterThanEqual', attribute, value).toString();
Query.isNull = (attribute) => new Query('isNull', attribute).toString();
Query.isNotNull = (attribute) => new Query('isNotNull', attribute).toString();
Query.between = (attribute, start, end) => new Query('between', attribute, [start, end]).toString();
Query.startsWith = (attribute, value) => new Query('startsWith', attribute, value).toString();
Query.endsWith = (attribute, value) => new Query('endsWith', attribute, value).toString();
Query.select = (attributes) => new Query('select', undefined, attributes).toString();
Query.search = (attribute, value) => new Query('search', attribute, value).toString();
Query.orderDesc = (attribute) => new Query('orderDesc', attribute).toString();
Query.orderAsc = (attribute) => new Query('orderAsc', attribute).toString();
Query.cursorAfter = (documentId) => new Query('cursorAfter', undefined, documentId).toString();
Query.cursorBefore = (documentId) => new Query('cursorBefore', undefined, documentId).toString();
Query.limit = (limit) => new Query('limit', undefined, limit).toString();
Query.offset = (offset) => new Query('offset', undefined, offset).toString();
Query.contains = (attribute, value) => new Query('contains', attribute, value).toString();
Query.or = (queries) => new Query('or', undefined, queries.map((q) => (typeof q === 'string' ? JSON.parse(q) : q))).toString();
Query.and = (queries) => new Query('and', undefined, queries.map((q) => (typeof q === 'string' ? JSON.parse(q) : q))).toString();

function parseQuery(q) {
    if (typeof q === 'string') {
        try {
            return JSON.parse(q);
        } catch (e) {
            throw new Error(`Invalid query string: ${q}`);
        }
    }
    if (q && typeof q === 'object') {
        return { method: q.method, attribute: q.attribute, values: q.values };
    }
    throw new Error(`Invalid query: ${q}`);
}

function translateQueries(queries) {
    const where = [];
    const params = [];
    let order = null;
    let limit = null;
    let offset = null;

    if (!Array.isArray(queries)) queries = [];

    const addParam = (value) => {
        params.push(value);
        return '$' + params.length;
    };

    const buildCondition = (method, attribute, values) => {
        const col = mapAttribute(attribute);
        const list = (values && Array.isArray(values)) ? values : (values !== undefined && values !== null ? [values] : []);

        switch (method) {
            case 'equal': {
                if (list.length > 1) {
                    return `${col} IN (${list.map((v) => addParam(v)).join(', ')})`;
                }
                const v = list[0];
                if (v === null || v === undefined) return `${col} IS NULL`;
                return `${col} = ${addParam(v)}`;
            }
            case 'notEqual': {
                if (list.length > 1) {
                    return `${col} NOT IN (${list.map((v) => addParam(v)).join(', ')})`;
                }
                const v = list[0];
                if (v === null || v === undefined) return `${col} IS NOT NULL`;
                return `${col} != ${addParam(v)}`;
            }
            case 'lessThan':
                return `${col} < ${addParam(list[0])}`;
            case 'lessThanEqual':
                return `${col} <= ${addParam(list[0])}`;
            case 'greaterThan':
                return `${col} > ${addParam(list[0])}`;
            case 'greaterThanEqual':
                return `${col} >= ${addParam(list[0])}`;
            case 'isNull':
                return `${col} IS NULL`;
            case 'isNotNull':
                return `${col} IS NOT NULL`;
            case 'between':
                return `${col} BETWEEN ${addParam(list[0])} AND ${addParam(list[1])}`;
            case 'startsWith':
                return `${col} LIKE ${addParam(escapeLike(list[0]) + '%')}`;
            case 'endsWith':
                return `${col} LIKE ${addParam('%' + escapeLike(list[0]))}`;
            case 'search':
                return `${col} ILIKE ${addParam('%' + String(list[0]) + '%')}`;
            case 'contains':
                return `${col} IN (${list.map((v) => addParam(v)).join(', ')})`;
            default:
                throw new Error(`Unsupported query method: ${method}`);
        }
    };

    for (const q of queries) {
        const parsed = parseQuery(q);
        const { method, attribute, values } = parsed;

        switch (method) {
            case 'orderDesc':
                order = { field: mapAttribute(attribute), dir: 'DESC' };
                break;
            case 'orderAsc':
                order = { field: mapAttribute(attribute), dir: 'ASC' };
                break;
            case 'limit':
                limit = parseInt(values[0], 10);
                break;
            case 'offset':
                offset = parseInt(values[0], 10);
                break;
            case 'cursorAfter':
                where.push(`${mapAttribute('$id')} > ${addParam(values[0])}`);
                if (!order) order = { field: 'id', dir: 'ASC' };
                break;
            case 'cursorBefore':
                where.push(`${mapAttribute('$id')} < ${addParam(values[0])}`);
                if (!order) order = { field: 'id', dir: 'ASC' };
                break;
            case 'or': {
                const subs = (values || []).map((sub) => buildCondition(sub.method, sub.attribute, sub.values));
                where.push('(' + subs.join(' OR ') + ')');
                break;
            }
            case 'and': {
                const subs = (values || []).map((sub) => buildCondition(sub.method, sub.attribute, sub.values));
                where.push('(' + subs.join(' AND ') + ')');
                break;
            }
            default:
                where.push(buildCondition(method, attribute, values));
                break;
        }
    }

    return { where: where.join(' AND '), params, order, limit, offset };
}

module.exports = { Query, mapAttribute, translateQueries };
