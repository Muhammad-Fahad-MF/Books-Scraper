import express, { type Express, type Response, type Request } from 'express';
import { enrichInputSchema, type EnrichOutput } from './models/enrich-model.js';
import morgan from "morgan";
import { getMessage } from './llm/hello.js';

const LLM_STUB = 0;

const app: Express = express();
app.disable("x-powered-by");
app.set("etag", false);  // for development

app.use(express.json());
app.use(morgan("dev"));

const port = 3000;

app.get('/', (req: Request, res: Response) => {
    res.send({ message: "hello"});
});

app.post('/enrich-record', async (req: Request, res: Response) => {
    const request = enrichInputSchema.safeParse(req.body);
    if (!request.success) {
        return res.status(422).json({ detail: request.error.issues });
    }
    const record = request.data;
    if (LLM_STUB) {
        const response: EnrichOutput = {
            cleansed_description: {
                value: record?.description,
                quality: "clean",
                confidence: 0.5,
                reason: "haha no reason!"
            },
            summary: "Here is a very good summary!",
            category: {
                value: "business",
                confidence: 0,
                reason: "no reason haha"
            },
            target_audience: {
                value: "academic",
                confidence: 0.2,
                reason: "coding has to be academic"
            }
        };
        return res.status(201).json(response);
    }
    console.log("before request!");
    const response = await getMessage(record);
    console.log("after request!");
    return res.send(201).json(response);
});

app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});