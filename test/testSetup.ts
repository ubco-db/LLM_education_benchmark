import dotenv from 'dotenv';
dotenv.config();

//used to run supertest, but ran into problems mocking the routes with supertest
import express from 'express';
import { initVectorStores, deleteCourseSettingTable, deleteDocumentAggregateTable, deleteDocumentTable, deleteQuestionTable } from './databaseOperations';
import chatbotRouter from '../src/routes/chatbot';
import documentRouter from '../src/routes/documents';
import questionRouter from '../src/routes/question';
//services, only assisting tests, not testing services here
import { ChatbotService } from '../src/service/chatbot';
import { QuestionService } from '../src/service/question';
import { DocumentService } from '../src/service/document';
import { ChatbotSettingService } from '../src/service/chatbotSetting';
import { CustomRequest } from '../src/common_types/customTypes';
import { defaultChatbotSetting } from '../src/common_types/types';
import { DataSourceOptions } from "typeorm";
import { TypeORMVectorStore } from '@langchain/community/vectorstores/typeorm';
import cors from 'cors';
import morgan from 'morgan';
import ApiTokenMiddleware from '../src/middlewares/apiToken.middleware';
import { HelpMeDataSource } from '../src/database/connection';

const app = express();
app.use(express.json());
app.use(cors());
app.use(morgan("combined"));
async function initApp() {
  const options = parseArguments();
  try {
      const postgresConnectionOptions = {
        type: 'postgres',
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: options.database,
      } as DataSourceOptions; 

    const { questionStore, documentStore, documentAggregateStore, courseSettingStore } = await initVectorStores(postgresConnectionOptions);
    HelpMeDataSource.initialize();
    // create different services for each course
    async function createServices(repository: any, servicesMap: any) {
      const courses = await repository.find();

      courses.forEach((course: { pageContent: string; metadata: JSON }) => {
        const courseId = course.pageContent;
        servicesMap.set(courseId, {
          chatbotService: new ChatbotService(documentStore, questionStore, documentAggregateStore, courseSettingStore, courseId),
          questionService: new QuestionService(questionStore, courseId),
          documentService: new DocumentService(documentAggregateStore, documentStore, courseId),
          chatbotSettingService: new ChatbotSettingService(courseSettingStore, courseId),
        });
      });
      return servicesMap;
    }

    let servicesMap = new Map<string, any>();
    const repository = courseSettingStore.appDataSource.getRepository(courseSettingStore.documentEntity);
    servicesMap = await createServices(repository, servicesMap);

    app.use(ApiTokenMiddleware());

    // incoming request with courseId will grab corresponding services and pass on to paths
    app.use('/chat/:courseId', async (req: CustomRequest, res, next) => {
      const courseId = req.params.courseId;
      let services = servicesMap.get(courseId);
      if (!services) {
        // meaning that course is not found, create new course settings with default values for the courseId
        // note that uniqueness is ensured through external courseId
        // so unorthodoxly, the route here handles creation of new course.
        const newCourseSetting = await repository.save({
          pageContent: courseId,
          metadata: defaultChatbotSetting,
        });
        // Initialize services for the new course setting
        services = {
          chatbotService: new ChatbotService(documentStore, questionStore, documentAggregateStore, courseSettingStore, courseId),
          questionService: new QuestionService(questionStore, courseId),
          documentService: new DocumentService(documentAggregateStore, documentStore, courseId),
          chatbotSettingService: new ChatbotSettingService(courseSettingStore, courseId),
        };
        servicesMap.set(courseId, services);
      }
      // pass on the service of the course to the routes
      req.services = services;
      next();
    });
    app.post('/chat/reset', async (req, res) => {
      servicesMap.clear();
      try {
        res.status(200).send('Server state reset successfully.');
      } catch (error) {
        res.status(500).send('Failed to reset server state.');
      }
    });

    app.use('/chat/:courseId', (req: CustomRequest, res, next) => {
      if (!req.services) {
          return res.status(404).json({ error: 'Errored with creation of services' });
      }
      chatbotRouter(req.services.chatbotService, req.services.chatbotSettingService)(req, res, next);
    });
    app.use('/chat/:courseId', (req: CustomRequest, res, next) => {
        if (!req.services) {
            return res.status(404).json({ error: 'Errored with creation of services' });
        }
        documentRouter(req.services.documentService, req.services.chatbotService)(req, res, next);
    });
    app.use('/chat/:courseId', (req: CustomRequest, res, next) => {
        if (!req.services) {
            return res.status(404).json({ error: 'Errored with creation of services' });
        }
        questionRouter(req.services.chatbotService, req.services.questionService)(req, res, next);
    });

    // Routes to delete repositories
    app.delete('/delete/questionStore', async (req, res) => {
      try {
        await deleteQuestionTable(questionStore);
        res.status(200).send('questionStore cleared successfully.');
      } catch (error) {
        res.status(500).send('Failed to clear questionStore.');
      }
    });

    app.delete('/delete/documentStore', async (req, res) => {
      try {
        deleteDocumentTable(documentStore);
        res.status(200).send('documentStore cleared successfully.');
      } catch (error) {
        res.status(500).send('Failed to clear documentStore.');
      }
    });

    app.delete('/delete/documentAggregateStore', async (req, res) => {
      try {
        deleteDocumentAggregateTable(documentAggregateStore);
        res.status(200).send('documentAggregateStore cleared successfully.');
      } catch (error) {
        res.status(500).send('Failed to clear documentAggregateStore.');
      }
    });

    app.delete('/delete/courseSettingStore', async (req, res) => {
      try {
        deleteCourseSettingTable(courseSettingStore);
        res.status(200).send('courseSettingStore cleared successfully.');
      } catch (error) {
        res.status(500).send('Failed to clear courseSettingStore.');
      }
    });

    const PORT = 3004;
    app.listen(PORT, () => {
      console.log(`Testing server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to initialize app:', error);
  }
}

initApp();

function parseArguments() {
  const args = process.argv.slice(2);
  const options: { [key: string]: string } = {};

  args.forEach(arg => {
    const [key, value] = arg.split('=');
    options[key] = value;
  });

  return options;
}
