const { databases, DATABASE_ID, ID, Query } = require('../config/appwrite');

class BaseService {
    constructor(collectionId) {
        this.collectionId = collectionId;
        this.databases = databases;
        this.databaseId = DATABASE_ID;
    }

    async create(data) {
        try {
            const documentId = ID.unique();
            const document = await this.databases.createDocument(
                this.databaseId,
                this.collectionId,
                documentId,
                data
            );
            return { success: true, data: document };
        } catch (error) {
            console.error(`Error creating document in ${this.collectionId}:`, error);
            return { success: false, error: error.message };
        }
    }

    async getById(documentId) {
        try {
            const document = await this.databases.getDocument(
                this.databaseId,
                this.collectionId,
                documentId
            );
            return { success: true, data: document };
        } catch (error) {
            console.error(`Error getting document ${documentId} from ${this.collectionId}:`, error);
            return { success: false, error: error.message };
        }
    }

    async update(documentId, data) {
        try {
            const document = await this.databases.updateDocument(
                this.databaseId,
                this.collectionId,
                documentId,
                data
            );
            return { success: true, data: document };
        } catch (error) {
            console.error(`Error updating document ${documentId} in ${this.collectionId}:`, error);
            return { success: false, error: error.message };
        }
    }

    async delete(documentId) {
        try {
            await this.databases.deleteDocument(
                this.databaseId,
                this.collectionId,
                documentId
            );
            return { success: true };
        } catch (error) {
            console.error(`Error deleting document ${documentId} from ${this.collectionId}:`, error);
            return { success: false, error: error.message };
        }
    }

    async list(queries = [], limit = 25, offset = 0, orderField = '$createdAt', orderType = 'DESC') {
        try {
            const documents = await this.databases.listDocuments(
                this.databaseId,
                this.collectionId,
                queries,
                limit,
                offset,
                orderField,
                orderType
            );
            return { success: true, data: documents };
        } catch (error) {
            console.error(`Error listing documents from ${this.collectionId}:`, error);
            return { success: false, error: error.message };
        }
    }

    async search(query, searchField = 'name') {
        try {
            const documents = await this.databases.listDocuments(
                this.databaseId,
                this.collectionId,
                [
                    `equal("${searchField}", "${query}")`
                ]
            );
            return { success: true, data: documents };
        } catch (error) {
            console.error(`Error searching in ${this.collectionId}:`, error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = BaseService;