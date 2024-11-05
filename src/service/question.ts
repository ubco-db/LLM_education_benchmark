
require('dotenv').config();
import { TypeORMVectorStore } from "@langchain/community/vectorstores/typeorm";

export class QuestionService {

  constructor(private questionStore: TypeORMVectorStore, public courseId: string) { }

  setCourseId = (courseId: string) => {
    this.courseId = courseId;
  }

  getVectorStoreRepository = async (vectorStore: TypeORMVectorStore) => {
    const repository = vectorStore.appDataSource.getRepository(
      vectorStore.documentEntity
    );

    return repository;
  };

  getAllQuestions = async () => {
    const repository = await this.getVectorStoreRepository(this.questionStore);

    const questions = await repository.createQueryBuilder("question")
      .select(["question.id", "question.pageContent", "question.metadata"])
      .where("question.metadata ->> 'courseId' = :courseId", { courseId: String(this.courseId) })
      .getMany();

    return questions;
  };

  updateQuestion = async (id: string, questionText: string, answer: string, verified: boolean, sourceDocuments: any) => {
    const repository = await this.getVectorStoreRepository(this.questionStore);

    const entry = await repository
      .createQueryBuilder("question")
      .where("question.id = :id", { id })
      .getOne();

    if (!entry) {
      throw new Error('Question not found');
    }

    if (questionText) {
      entry.pageContent = questionText;
    }

    // Update the metadata with the new values, falling back to existing values if not provided
    entry.metadata = {
      ...entry.metadata,
      answer: answer,
      verified: typeof verified !== 'undefined' ? verified : entry.metadata.verified,
      sourceDocuments: sourceDocuments || entry.metadata.sourceDocuments,
    };

    return await repository.save(entry);
  };

  deleteAllQuestions = async () => {
    const repository = await this.getVectorStoreRepository(this.questionStore);
    await repository.delete({});
  }


  disconnect = async () => {
    await this.questionStore.appDataSource.destroy();
  };

}
