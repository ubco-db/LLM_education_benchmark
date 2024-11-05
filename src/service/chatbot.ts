import axios from "axios";
const fse = require("fs-extra");
const path = require("path");
require("dotenv").config();

import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { createUploadDirectory, deleteDirectory } from "../../util/upload";
import { DataSourceOptions, In, Repository } from "typeorm";
import { MultiVectorRetriever } from "langchain/retrievers/multi_vector";
import { TypeORMVectorStore } from "@langchain/community/vectorstores/typeorm";
import { RunnableSequence } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";
import { AIeditChunk } from "./RAGservices/openAIEdit";
import { LLMChain, loadSummarizationChain } from "langchain/chains";
import { Message } from "../../util/types";
import { getFileTypeAndName } from "../../util/utils";
import { TFIDF } from "../../util/natural";
import { PPTXLoader } from "langchain/document_loaders/fs/pptx";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { CSVLoader } from "langchain/document_loaders/fs/csv";
import { DocxLoader } from "langchain/document_loaders/fs/docx";
import OpenAI from "openai";
import { Ollama } from "@langchain/community/llms/ollama";
import { assistant_mapping_id } from "../common_types/types";

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

export class ChatbotService {
  private embeddings: OpenAIEmbeddings;
  private llmModel = "llama3";
  private questionChain: LLMChain;
  private questionGeneratorChain: LLMChain;
  private topK: number;
  private similarityThresholdQuestion: number;
  private similarityThresholdDocument: number;
  private documentRepository: Repository<any>;
  private questionRepository: Repository<any>;
  private documentAggregateRepository: Repository<any>;
  private courseSettingRepository: Repository<any>;
  constructor(
    private documentStore: TypeORMVectorStore,
    private questionStore: TypeORMVectorStore,
    private documentAggregateStore: TypeORMVectorStore,
    private courseSettingStore: TypeORMVectorStore,
    private courseId: string
  ) {
    this.embeddings = new OpenAIEmbeddings();
    this.initializeRepositories();
    this.initializeChains();
  }
  private initializeRepositories() {
    this.documentRepository = this.documentStore.appDataSource.getRepository(
      this.documentStore.documentEntity
    );
    this.questionRepository = this.questionStore.appDataSource.getRepository(
      this.questionStore.documentEntity
    );
    this.documentAggregateRepository =
      this.documentAggregateStore.appDataSource.getRepository(
        this.documentAggregateStore.documentEntity
      );
    this.courseSettingRepository =
      this.courseSettingStore.appDataSource.getRepository(
        this.courseSettingStore.documentEntity
      );
  }
  updateChatbotSetting() {
    this.initializeChains();
  }
  private async initializeChains() {
    const courseSetting = await this.courseSettingRepository
      .createQueryBuilder("course_setting")
      .select([
        "course_setting.id",
        "course_setting.pageContent",
        "course_setting.metadata",
      ])
      .where("course_setting.pageContent = :id", { id: this.courseId })
      .getOne();

    const questionPrompt = PromptTemplate.fromTemplate(
      `
        Use the following pieces of context to answer the question at the end. 
        ----------------
        ` +
      courseSetting.metadata.prompt +
      `
        ----------------
        CONTEXT: {context}
        ----------------
        CHAT HISTORY: {chatHistory}
        ----------------
        QUESTION: {question}
        ----------------
        Helpful Answer:`
    );

    const questionGeneratorPrompt = PromptTemplate.fromTemplate(`›
        Given the previous questions and a follow up question, rephrase the follow up question to be a standalone question.
        ----------------
        RULES:
            1) If there is no previous questions, return EXACTLY the follow up question
            2) If the question is not a follow up question, return EXACTLY the follow up question
            3) If the question is a follow up, rephrase the follow up with the most recent message at the bottom
        ----------------
        FOLLOWUP QUESTION: {question}
        ----------------
        PREVIOUS QUESTIONS (MOST RECENT AT THE BOTTOM): {chatHistory}
        ----------------
        Standalone question:`);
    //change this when using models not from openai
    let questionModel;
    let questionGeneratorModel;
    this.llmModel = courseSetting.metadata.modelName;
    if (!this.llmModel.startsWith("gpt")) {
      questionModel = new Ollama({
        model: this.llmModel,
        baseUrl: "http://localhost:11434",
      });
      questionGeneratorModel = new Ollama({
        model: this.llmModel,
        baseUrl: "http://localhost:11434",
      });
    } else {
      questionModel = new ChatOpenAI({
        modelName: courseSetting.metadata.modelName || "gpt-3.5-turbo",
        temperature: courseSetting.metadata.temperature,
      });

      questionGeneratorModel = new ChatOpenAI({
        modelName: courseSetting.metadata.modelName || "gpt-3.5-turbo",
        temperature: courseSetting.metadata.temperature,
      });
    }

    this.questionChain = new LLMChain({
      llm: questionModel,
      prompt: questionPrompt,
    });

    this.questionGeneratorChain = new LLMChain({
      llm: questionGeneratorModel,
      prompt: questionGeneratorPrompt,
    });
    this.topK = courseSetting.metadata.topK;
    this.similarityThresholdDocument =
      courseSetting.metadata.similarityThresholdDocuments;
    this.similarityThresholdQuestion =
      courseSetting.metadata.similarityThresholdQuestions;
  }

  disconnect = async () => {
    await this.documentStore.appDataSource.destroy();
    await this.questionStore.appDataSource.destroy();
  };

  // ------------------------------ MANAGE VECTORSTORES ------------------------------ //

  resetCourse = async () => {
    await this.documentRepository
      .createQueryBuilder()
      .delete()
      .from("document")
      .where("metadata ->> 'courseId' = :courseId", {
        courseId: this.courseId,
      })
      .execute();

    await this.questionRepository
      .createQueryBuilder()
      .delete()
      .from("question")
      .where("metadata ->> 'courseId' = :courseId", {
        courseId: this.courseId,
      })
      .execute();
  };

  addVectors = async (vectors: number[][], documents: Document[]) => {
    const rows = vectors.map((embedding, idx) => {
      const embeddingString = `[${embedding.join(",")}]`;
      const documentRow = {
        pageContent: documents[idx].pageContent,
        embedding: embeddingString,
        metadata: documents[idx].metadata,
      };

      return documentRow;
    });

    const chunkSize = 500;
    const ids = [];
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);

      const savedChunk = await this.documentRepository.save(chunk);
      const chunkIds = savedChunk.map((doc) => doc.id);
      ids.push(...chunkIds);
    }
    return ids;
  };

  addQuestion = async ({
    query,
    answer,
    sourceDocuments,
  }: {
    query: string;
    answer: string;
    sourceDocuments: Document[];
  }) => {
    const questionVector = await this.embeddings.embedQuery(query);
    const embeddingString = `[${questionVector.join(",")}]`;

    const documentMap = new Map();

    sourceDocuments.forEach((doc) => {
      const key = doc.metadata.name + "|" + doc.metadata.source; // Create a unique key

      if (documentMap.has(key)) {
        // If the document already exists, add the page number if it's not already included
        const existingDoc = documentMap.get(key);
        if (!existingDoc.pageNumbers.includes(doc.metadata.loc.pageNumber)) {
          existingDoc.pageNumbers.push(doc.metadata.loc.pageNumber);
          existingDoc.content.push(doc.pageContent);
        }
      } else {
        documentMap.set(key, {
          content: [doc.pageContent], // Initialize content as an array
          docName: doc.metadata.name,
          sourceLink: doc.metadata.source,
          pageNumbers: [doc.metadata.loc.pageNumber],
        });
      }

    });

    // Convert the Map back to an array
    const transformedSourceDocuments = Array.from(documentMap.values());

    const documentRow = {
      pageContent: query,
      embedding: embeddingString,
      metadata: {
        courseId: this.courseId,
        answer: answer,
        verified: false,
        sourceDocuments: transformedSourceDocuments,
      },
    };

    // const savedQuestion = await this.questionRepository.save(documentRow);
    const savedQuestion = documentRow;
    return {
      question: savedQuestion.pageContent,
      answer: savedQuestion.metadata.answer,
      sourceDocuments: savedQuestion.metadata.sourceDocuments,
      courseId: savedQuestion.metadata.courseId,
    };
  };

  addDocumentsRecursive = async (url: string) => { };

  addDocumentsFromURL = async (
    url: string,
    sourceOverride: string | undefined = undefined
  ) => {
    const destination = `./public/uploads/${Math.random()
      .toString(16)
      .slice(2)}`;

    const urlParts = url.split("/");
    const file = urlParts[urlParts.length - 1];
    const savePath = path.join(destination, file);

    try {
      await createUploadDirectory(destination);
      const response = await axios({
        method: "get",
        url,
        responseType: "stream",
      });

      const writer = fse.createWriteStream(savePath);
      response.data.pipe(writer);
      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      const savedDocuments = await this.addDocumentsFromPath(
        file,
        destination,
        {
          source: sourceOverride || url,
        }
      );

      return savedDocuments;
    } catch (e) {
      throw e;
    } finally {
      await deleteDirectory(destination);
    }
  };
  addDocumentsFromPath = async (
    file: string,
    path: string,
    metaData: any = {}
  ) => {
    const { type, name } = getFileTypeAndName(file);

    const directoryLoader = await this.getDirectoryLoader(path);
    const rawDocuments = await this.loadDocuments(directoryLoader);
    const documentChunks = await this.splitDocuments(rawDocuments);

    if (documentChunks.length === 0) {
      throw new Error("No documents found");
    }

    const formattedDocumentChunks = await Promise.all(
      documentChunks.map(async (document) => {


        return new Document({
          pageContent: document.pageContent,
          metadata: {
            ...metaData,
            loc: document.metadata.loc,
            courseId: this.courseId,
            type,
            name,
          },
        });
      })
    );

    const ids = await this.addDocuments(formattedDocumentChunks);

    this.addAggregatedDocument(file, metaData.source, ids);
    return {
      ids,
      type,
      name,
    };
  };

  addDocuments = async (documents: Document[]) => {
    // Extract editedChunk from metadata for embedding
    const chunksForEmbedding = documents.map(({ pageContent }) => pageContent);

    const ids = await this.addVectors(
      await this.embeddings.embedDocuments(chunksForEmbedding),
      documents
    );

    return ids;
  };

  addAggregatedDocument = async (
    fileName: string,
    source: string,
    ids: any[]
  ) => {
    const documentRow = {
      pageContent: fileName,
      metadata: {
        courseId: this.courseId,
        source: source,
        subDocumentIds: ids,
      },
    };
    await this.documentAggregateRepository.save(documentRow);
    console.log(
      `Document and associated vector entries successfully added for ID ${fileName}.`
    );
  };
  getDocuments = async (cid: number) => {
    const documents = await this.documentRepository
      .createQueryBuilder("document")
      .select(["document.id", "document.pageContent", "document.metadata"])
      .where("document.metadata ->> 'courseId' = :courseId", {
        courseId: String(cid),
      })
      .getMany();

    return documents;
  };

  deleteDocuments = async (id: String) => {
    const doc = await this.documentAggregateRepository
      .createQueryBuilder()
      .select(["document_aggregate.metadata"])
      .where("document_aggregate.id = :id", { id })
      .getOne();
    if (!doc) {
      throw new Error(`Document with ID ${id} not found.`);
    }
    const ids = doc.metadata.subDocumentIds;
    await this.deleteVectorEntries(ids, this.documentRepository);

    await this.documentRepository
      .createQueryBuilder()
      .delete()
      .from("document_aggregate")
      .where("id = :id", { id })
      .execute();
    return {
      message: `Document and associated vector entries successfully deleted for ID ${id}.`,
    };
  };

  deleteQuestions = async (ids: string[]) => {
    return await this.deleteVectorEntries(ids, this.questionRepository);
  };

  deleteVectorEntries = async (ids: string[], repository: Repository<any>) => {
    const entries = await repository.delete({
      id: In(ids),
    });

    return { affected: entries.affected };
  };

  getDirectoryLoader = async (filePath: string) => {
    const directoryLoader = new DirectoryLoader(filePath, {
      ".pdf": (path) => new PDFLoader(path, { splitPages: true }),
      ".docx": (path) => new DocxLoader(path),
      // '.json': path => new JSONLoader(path, '/texts'),
      // '.jsonl': path => new JSONLinesLoader(path, '/html'),
      ".txt": (path) => new TextLoader(path),
      ".csv": (path) => new CSVLoader(path, "text"),
      // ".md": (path) => new UnstructuredLoader(path),
      // '.htm': path => new UnstructuredLoader(path),
      // '.html': path => new UnstructuredLoader(path),
      // '.ppt': path => new UnstructuredLoader(path),
      ".pptx": (path) => new PPTXLoader(path),
    });

    return directoryLoader;
  };

  loadDocuments = async (directoryLoader: DirectoryLoader) => {
    const documents = await directoryLoader.load();
    return documents;
  };

  splitDocuments = async (documents: Document[]) => {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 20,
    });

    const documentChunks = splitter.splitDocuments(documents);
    return documentChunks;
  };

  // ------------------------------ CHAINS ------------------------------ //

  ask = async (question: string, history: Message[]): Promise<any> => {
    const chainResponse = await this.callConversationalDocumentQAChain(
      question,
      history
    );
    const similarityScore = TFIDF("I don't know", chainResponse.answer);

    if (similarityScore < 0.8) {
      return chainResponse;
    } else {
      return {
        answer: "I don't know",
      };
    }
  };

  callConversationalDocumentQAChain = async (
    question: string,
    history: Message[]
  ) => {
    interface ChainInput {
      question: string;
      rephrasedQuestion: string;
      chatHistory: Message[];
      context: TypeORMVectorStore;
    }
    const chain = RunnableSequence.from([
      {
        question: (input: ChainInput) => input.question,
        rephrasedQuestion: (input: ChainInput) => input.rephrasedQuestion,
        chatHistory: (input: ChainInput) => input.chatHistory,
        context: async (input: ChainInput) => input.context,
      },
      this.performDocumentQA,
    ]);

    const userQuestionsString = this.historyToString(history, false);
    let rephrasedQuestion = question;

    if (userQuestionsString && userQuestionsString.length > 0) {
      // Rephrases the original question to be better suited for the key word search when finding relevant documents
      rephrasedQuestion = await this.invokeQuestionGeneratorChain({
        question,
        chatHistoryString: userQuestionsString,
      });
    }

    // if rephrased question is similar to any questions, return immedietly
    // const similarQuestions = await this.questionStore.similaritySearchWithScore(
    //   rephrasedQuestion,
    //   3,
    //   {
    //     courseId: this.courseId,
    //   }
    // );

    // const similarQuestion: any = similarQuestions[0];
    // const hasSimilarQuestion =
    //   similarQuestions.length > 0 &&
    //   1 - similarQuestion[1] > this.similarityThresholdQuestion;
    // // if similar question found, return the answer
    // if (hasSimilarQuestion) {
    //   return {
    //     question: similarQuestion[0].pageContent,
    //     answer: similarQuestion[0].metadata.answer,
    //     questionId: similarQuestion[0].id,
    //     sourceDocuments: similarQuestion[0].metadata.sourceDocuments,
    //     verified: similarQuestion[0].metadata.verified,
    //     courseId: similarQuestion[0].metadata.courseId,
    //   };
    // }

    const response = await chain.invoke({
      question: question,
      chatHistory: history,
      rephrasedQuestion: rephrasedQuestion,
      context: this.documentStore,
    });
    // should have same format as returned json
    const insertedQuestion = await this.addQuestion({
      query: rephrasedQuestion,
      answer: response.text,
      sourceDocuments: response.sourceDocuments,
    });

    return insertedQuestion;
  };

  performDocumentQA = async (input: {
    question: string;
    rephrasedQuestion: string;
    chatHistory: Message[];
    context: TypeORMVectorStore;
  }) => {
    const fullChatHistoryString = input.chatHistory
      ? this.historyToString(input.chatHistory)
      : null;

    const sourceDocuments = await this.getRelevantDocuments(
      input.rephrasedQuestion,
      this.documentStore
    );
    const serializedDocs = this.formatDocumentsAsString(sourceDocuments);
    const text = await this.invokeQuestionChain({
      question: input.question,
      chatHistoryString: fullChatHistoryString ?? "",
      serializedDocs,
    });

    return {
      text,
      sourceDocuments,
    };
  };

  getRelevantDocuments = async (
    question: string,
    vectorStore: TypeORMVectorStore
  ) => {
    const similarDocuments = await vectorStore.similaritySearchWithScore(
      question,
      this.topK,
      {
        courseId: this.courseId,
      }
    );

    var filteredVectors = similarDocuments
      .filter((document) => 1 - document[1] >= this.similarityThresholdDocument)
      .slice(0, this.topK)
      .map((document) => document[0]);

    return filteredVectors;
  };

  invokeQuestionChain = async ({
    question,
    chatHistoryString,
    serializedDocs,
  }: {
    question: string;
    chatHistoryString?: string;
    serializedDocs: string;
  }) => {
    const response = await this.questionChain.invoke({
      chatHistory: chatHistoryString,
      context: serializedDocs,
      question: question, // USES ORIGINAL QUESTION
    });

    return response.text;
  };

  invokeQuestionGeneratorChain = async ({
    question,
    chatHistoryString,
  }: {
    question: string;
    chatHistoryString?: string;
  }) => {
    const response = await this.questionGeneratorChain.invoke({
      chatHistory: chatHistoryString,
      question: question,
    });

    return response.text;
  };

  formatDocumentsAsString = (
    documents: Document[],
    separator = "\n\n"
  ): string => documents.map((doc) => doc.pageContent).join(separator);

  historyToString = (history: Message[], includeAI = true) => {
    var stringifiedHistory = "";

    for (const message of history) {
      if (message.type === "userMessage") {
        stringifiedHistory += `Human: ${message.message}\n`;
      } else if (message.type === "apiMessage" && includeAI) {
        stringifiedHistory += `AI: ${message.message}\n\n\n`;
      }
    }

    return stringifiedHistory;
  };

  getFormattedDocuments = (documents: Document[]) => {
    // Convert to nested class to handle PDFs, TXTs, Webpages, etc
    const groupedDocuments: {
      [key: string]: Set<Part>;
    } = {};
    const documentsTypeMap = new Map<string, string>();
    documents.map((document: any) => {
      const key = document.metadata.name;
      let group: Set<Part> = groupedDocuments[key];

      if (!group) {
        group = new Set<Part>();
      }

      group.add({
        pageNumber: document.metadata.loc.pageNumber,
        source: document.metadata.source,
      });
      groupedDocuments[key] = group;

      let type = documentsTypeMap.get(key);
      if (!type) {
        type = document.metadata.type;
        documentsTypeMap.set(key, type || "");
      }
    });

    const formattedDocuments: GroupedDocument[] = [];
    for (const key in groupedDocuments) {
      formattedDocuments.push({
        name: key,
        type: documentsTypeMap.get(key)!,
        parts: Array.from(groupedDocuments[key]),
      });
    }

    return formattedDocuments;
  };

  getDocumentStore = () => {
    return this.documentStore;
  };

  getQuestionStore = () => {
    return this.questionStore;
  };

  getQuestionChain = () => {
    return this.questionChain;
  };

  getQuestionGeneratorChain = () => {
    return this.questionGeneratorChain;
  };

  getEmbeddings = () => {
    return this.embeddings;
  };

  getCourseId = () => {
    return this.courseId;
  };
}

// Currently loads entire repo from root
// loadGithubURL = async (url: string) => {
//     const loader = new GithubRepoLoader(url, {
//         branch: "main",
//         recursive: false,
//         unknown: "warn",
//     });
//     const docs = await loader.load();
//     return docs;
// };
/*
 */
