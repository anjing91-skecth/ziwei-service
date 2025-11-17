import express from 'express';
import cors from 'cors';
import { astro } from 'iztro';

const app = express();
app.use(cors());
app.use(express.json());

app.post('/ziwei/from-solar', async (req, res) => {
  try {
    const {
      birthDate,
      birthTime,
      tzOffsetHours = 7,
      gender = 'male'
    } = req.body;

    if (!birthDate || !birthTime) {
      return res.status(400).json({
        error: 'birthDate dan birthTime wajib!'
      });
    }

    // Hitung Zi Wei Dou Shu
    const astrolabe = await astro.astrolabeBySolarDate(
      birthDate,
      tzOffsetHours,
      gender
    );

    res.json({
      status: "success",
      meta: {
        birthDate,
        birthTime,
        tzOffsetHours,
        gender
      },
      lunar: astrolabe.lunar,
      ziwei_chart: astrolabe
    });

  } catch (err) {
    console.error("Ziwei error:", err);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Ziwei service online on ${PORT}`);
});
