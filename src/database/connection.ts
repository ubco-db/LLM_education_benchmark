import { DataSource, DataSourceOptions } from "typeorm";
import { TypeORMVectorStore } from "@langchain/community/vectorstores/typeorm";
import { OpenAIEmbeddings } from "@langchain/openai";

const embeddings = new OpenAIEmbeddings();

const postgresConnectionOptions = {
  type: "postgres",
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: "ai_trim",
} as DataSourceOptions;

export const HelpMeDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_HELP_ME_DATABASE,
});

export async function initVectorStores() {
  const questionStore = await TypeORMVectorStore.fromDataSource(embeddings, {
    postgresConnectionOptions,
    tableName: "question",
  });

  const documentStore = await TypeORMVectorStore.fromDataSource(embeddings, {
    postgresConnectionOptions,
    tableName: "document",
  });

  const documentAggregateStore = await TypeORMVectorStore.fromDataSource(
    embeddings,
    {
      postgresConnectionOptions,
      tableName: "document_aggregate",
    }
  );

  const courseSettingStore = await TypeORMVectorStore.fromDataSource(
    embeddings,
    {
      postgresConnectionOptions,
      tableName: "course_setting",
    }
  );

  // Ensure tables are created
  await questionStore.ensureTableInDatabase();
  await documentStore.ensureTableInDatabase();
  await documentAggregateStore.ensureTableInDatabase();
  await courseSettingStore.ensureTableInDatabase();

  return {
    questionStore,
    documentStore,
    documentAggregateStore,
    courseSettingStore,
  };
}
