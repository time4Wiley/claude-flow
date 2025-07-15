import express from 'express';
import cors from 'cors';
const _app = express();
const _PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());
app.get('/', (_req, _res) => {
  res.json({ message: 'Welcome to project2 API' });
});
app.listen(_PORT, () => {
  console.log(`Server running on port ${PORT}`);
});