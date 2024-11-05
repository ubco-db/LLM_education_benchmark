import { Request, Response, NextFunction } from 'express';
import { HelpMeDataSource } from '../database/connection';

export default function ApiTokenMiddleware() {
  return async function (req: Request, res: Response, next: NextFunction) {
    const apiToken = req.headers['hms_api_token'] || req.headers['HMS_API_TOKEN'];;

    if (!apiToken) {
      return res.status(401).json({ error: "API token was not provided in the request" });
    }

    const token_data = await HelpMeDataSource.manager.createQueryBuilder().select().from('chat_token_model', 'ctm')
      .where('ctm.token = :token', { token: apiToken }).getRawOne();

    if (!token_data) {
      return res.status(401).json({ error: "API token is invalid" });
    }

    if (token_data.max_uses - token_data.used <= 0) {
      return res.status(429).json({ error: "You have asked too many questions today, please come back tomorrow" });
    }

    const regexPath = /^\/chat\/[1-9]\d*\/ask$/;

    if (regexPath.test(req.path)) {
      await HelpMeDataSource.manager.createQueryBuilder()
        .update('chat_token_model')
        .set({ used: token_data.used + 1 })
        .where('token = :token', { token: apiToken })
        .execute();
    }

    next();
  }
}
