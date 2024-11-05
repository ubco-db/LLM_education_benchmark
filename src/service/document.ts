import axios from "axios";
const fse = require("fs-extra");
const path = require("path");
require("dotenv").config();

import { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { DataSourceOptions, In } from "typeorm";
import { TypeORMVectorStore } from "@langchain/community/vectorstores/typeorm";
import { ChatOpenAI } from "@langchain/openai";
import { LLMChain } from "langchain/chains";
interface Part {
  pageNumber: number;
  source: string;
}

interface GroupedDocument {
  name: string;
  type: string;
  parts: Part[];
}

type DocumentRecord =
  | [Document<Record<string, any>>, number] // With Score
  | Document<Record<string, any>>;

export interface ChatbotResponse {
  answer: string;
  sourceDocuments: GroupedDocument[];
  similarQuestions: DocumentRecord[];
}

interface Message {
  type: "apiMessage" | "userMessage";
  message: string | void;
}

export class DocumentService {
  private embeddings: OpenAIEmbeddings;

  constructor(
    private documentStoreAggregate: TypeORMVectorStore,
    private documentStore: TypeORMVectorStore,
    private courseId: string
  ) {
    this.embeddings = new OpenAIEmbeddings();
    this.courseId = courseId;
  }

  setCourseId = (courseId: string) => {
    this.courseId = courseId;
  };

  getVectorStoreRepository = async (vectorStore: TypeORMVectorStore) => {
    const repository = vectorStore.appDataSource.getRepository(vectorStore.documentEntity);

    return repository;
  };

  getAllDocumentChunks = async () => {
    const repository = await this.getVectorStoreRepository(this.documentStore);
    const documents = await repository
      .createQueryBuilder("document")
      .select(["document.id", "document.pageContent", "document.metadata"])
      .where("document.metadata ->> 'courseId' = :courseId", {
        courseId: String(this.courseId),
      })
      .getMany();

    return documents;
  };

  AIedit = async () => {};

  updateDocumentChunk = async (id: string, documentText: string, metadata?: any) => {
    const repository = await this.getVectorStoreRepository(this.documentStore);

    const entry = await repository
      .createQueryBuilder("document")
      .where("document.id = :id", { id })
      .getOne();

    if (!entry) {
      throw new Error("Document not found");
    }
    const questionVector = await this.embeddings.embedQuery(documentText);
    const embeddingString = `[${questionVector.join(",")}]`;
    entry.embedding = embeddingString;
    entry.pageContent = documentText;
    if (metadata) {
      entry.metadata = {
        ...entry.metadata,
        ...metadata,
      };
    }
    return await repository.save(entry);
  };

  getAllAggregateDocuments = async () => {
    const repository = await this.getVectorStoreRepository(this.documentStoreAggregate);

    const documents = await repository
      .createQueryBuilder("document_aggregate")
      .select([
        "document_aggregate.id",
        "document_aggregate.pageContent",
        "document_aggregate.metadata",
      ])
      .where("document_aggregate.metadata ->> 'courseId' = :courseId", {
        courseId: String(this.courseId),
      })
      .getMany();

    return documents;
  };

  updateDocument = async (id: number, documentText: string, verified: boolean) => {
    const repository = await this.getVectorStoreRepository(this.documentStoreAggregate);

    const entry = await repository
      .createQueryBuilder("document_aggregate")
      .where("document_aggregate.id = :id", { id })
      .getOne();

    if (!entry) {
      throw new Error("Document not found");
    }

    if (documentText) {
      entry.pageContent = documentText;
    }

    entry.metadata = {
      ...entry.metadata,
      verified: typeof verified !== "undefined" ? verified : entry.metadata.verified,
    };

    return await repository.save(entry);
  };

  deleteDocument = async (id: string) => {
    const repository = await this.getVectorStoreRepository(this.documentStoreAggregate);

    const entry = await repository
      .createQueryBuilder("document_aggregate")
      .where("document_aggregate.id = :id", { id })
      .getOne();

    if (!entry) {
      throw new Error("Document not found");
    }

    return await repository.remove(entry);
  };

  deleteDocumentChunk = async (id: string) => {
    const repository = await this.getVectorStoreRepository(this.documentStore);

    const entry = await repository
      .createQueryBuilder("document")
      .where("document.id = :id", { id })
      .getOne();

    if (!entry) {
      throw new Error("Document not found");
    }

    return await repository.remove(entry);
  };

  addDocumentChunk = async (documentText: string, metadata: any) => {
    const repository = await this.getVectorStoreRepository(this.documentStore);

    const questionVector = await this.embeddings.embedQuery(documentText);
    const embeddingString = `[${questionVector.join(",")}]`;

    const entry = repository.create({
      pageContent: documentText,
      embedding: embeddingString,
      metadata: {
        ...metadata,
        courseId: this.courseId,
      },
    });

    return await repository.save(entry);
  };
}
