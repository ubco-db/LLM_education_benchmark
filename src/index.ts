import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
dotenv.config();
import { HelpMeDataSource, initVectorStores } from './database/connection';
import { ChatbotService } from './service/chatbot';
import { QuestionService } from './service/question';
import { DocumentService } from './service/document';
import { CustomRequest } from './common_types/customTypes';
import chatbotRouter from './routes/chatbot';
import documentRouter from './routes/documents';
import questionRouter from './routes/question';
import { ChatbotSettingService } from './service/chatbotSetting';
import { defaultChatbotSetting } from './common_types/types';
import ApiTokenMiddleware from './middlewares/apiToken.middleware';
import documents from './routes/documents';

const app = express();

app.use(express.json());
app.use(cors());
app.use(morgan("combined"));
async function initApp() {
    try {
        const { questionStore, documentStore, documentAggregateStore, courseSettingStore } = await initVectorStores();
        HelpMeDataSource.initialize();
        // create different services for each course
        async function createServices(repository: any, servicesMap: any) {
            const courses = await repository.find();

            courses.forEach((course: { pageContent: string; metadata: JSON }) => {
                const courseId = course.pageContent;
                console.log('new service added with courseId:', courseId)
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
            req.services = services;
            next();
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
        // app.use('/chat/:courseId', (req: CustomRequest, res, next) => {
        //     if (!req.services) {
        //         return res.status(404).json({ error: 'Errored with creation of services' });
        //     }
        //     app.use('/chat/:courseId', chatbotRouter(req.services.chatbotService, req.services.chatbotSettingService));
        //     app.use('/chat/:courseId', documentRouter(req.services.documentService, req.services.chatbotService));
        //     app.use('/chat/:courseId', questionRouter(req.services.chatbotService, req.services.questionService));
        //     next();
        // });

        const PORT = process.env.PORT || 3003;
        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Failed to initialize app:', error);
    }
}

initApp();
