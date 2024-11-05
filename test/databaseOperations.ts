
import { TypeORMVectorStore } from '@langchain/community/vectorstores/typeorm';
import { OpenAIEmbeddings } from '@langchain/openai';
import { DataSourceOptions } from 'typeorm';

const embeddings = new OpenAIEmbeddings();

export async function initVectorStores(postgresConnectionOptions: DataSourceOptions) {

  const questionStore = await TypeORMVectorStore.fromDataSource(embeddings, {
    postgresConnectionOptions,
    tableName: 'question',
  });

  const documentStore = await TypeORMVectorStore.fromDataSource(embeddings, {
    postgresConnectionOptions,
    tableName: 'document',
  });

  const documentAggregateStore = await TypeORMVectorStore.fromDataSource(embeddings, {
    postgresConnectionOptions,
    tableName: 'document_aggregate',
  });

  const courseSettingStore = await TypeORMVectorStore.fromDataSource(embeddings, {
    postgresConnectionOptions,
    tableName: 'course_setting',
  });

  // Ensure tables are created
  await questionStore.ensureTableInDatabase();
  await documentStore.ensureTableInDatabase();
  await documentAggregateStore.ensureTableInDatabase();
  await courseSettingStore.ensureTableInDatabase();

  return { questionStore, documentStore, documentAggregateStore, courseSettingStore };
}

export async function initializeRepositories(questionStore: TypeORMVectorStore, documentStore: TypeORMVectorStore, documentAggregateStore: TypeORMVectorStore, courseSettingStore: TypeORMVectorStore) {
  const questionRepository = questionStore.appDataSource.getRepository(questionStore.documentEntity);
  const documentRepository = documentStore.appDataSource.getRepository(documentStore.documentEntity);
  const documentAggregateRepository = documentAggregateStore.appDataSource.getRepository(documentAggregateStore.documentEntity);
  const courseSettingRepository = courseSettingStore.appDataSource.getRepository(courseSettingStore.documentEntity);
  return { questionRepository, documentRepository, documentAggregateRepository, courseSettingRepository };
}

export async function resetDB(questionStore: TypeORMVectorStore, documentStore: TypeORMVectorStore, documentAggregateStore: TypeORMVectorStore, courseSettingStore: TypeORMVectorStore) {
  const { questionRepository, documentRepository, documentAggregateRepository, courseSettingRepository } = await initializeRepositories(questionStore, documentStore, documentAggregateStore, courseSettingStore);
  if (questionStore?.appDataSource) {
    await questionRepository.delete({});
  }
  if (documentStore?.appDataSource) {
    await documentRepository.delete({});
  }
  if (documentAggregateStore?.appDataSource) {
    await documentAggregateRepository.delete({});
  }
  if (courseSettingStore?.appDataSource) {
    await courseSettingRepository.delete({});
  }
}

export async function deleteQuestionTable(questionStore: TypeORMVectorStore) {
  const questionRepository = questionStore.appDataSource.getRepository(questionStore.documentEntity);
  await questionRepository.delete({});
}

export async function deleteDocumentTable(documentStore: TypeORMVectorStore) {
  const documentRepository = documentStore.appDataSource.getRepository(documentStore.documentEntity);
  await documentRepository.delete({});
}

export async function deleteDocumentAggregateTable(documentAggregateStore: TypeORMVectorStore) {
  const documentAggregateRepository = documentAggregateStore.appDataSource.getRepository(documentAggregateStore.documentEntity);
  await documentAggregateRepository.delete({});
}

export async function deleteCourseSettingTable(courseSettingStore: TypeORMVectorStore) {
  const courseSettingRepository = courseSettingStore.appDataSource.getRepository(courseSettingStore.documentEntity);
  await courseSettingRepository.delete({});
}

const integrationConnectionOptions = {
    type: 'postgres',
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: "integrationTest",
  } as DataSourceOptions; 

export async function initIntegrationVectorStores(){
  return initVectorStores(integrationConnectionOptions);
}
const ragConnectionOptions = {
    type: 'postgres',
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: "RAGtest",
  } as DataSourceOptions;
export async function initRAGtestingVectorStores(){
  return initVectorStores(integrationConnectionOptions);
}