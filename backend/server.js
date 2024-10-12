
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const { Configuration, OpenAIApi } = require("openai");
const { exec } = require("child_process");
const fs = require("fs");
const tmp = require("tmp");

const app = express();
const port = 5000;

// Replace with your OpenAI API key
require('dotenv').config();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const configuration = new Configuration({
  apiKey: OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

app.use(cors());
app.use(bodyParser.json({ limit: "1mb" }));

app.post("/process", async (req, res) => {
  const { jobDescription, resumeContent, customMessage } = req.body;

  if (!jobDescription || !resumeContent) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  const prompt = `
You are an expert resume writer skilled in LaTeX formatting. A user has provided their LaTeX resume and a job description. Your task is to modify the resume to better match the job description, focusing on the professional summary, skills, and work experience sections. Ensure the LaTeX syntax is correct and the formatting remains professional.

Job Description:
${jobDescription}

User's Resume in LaTeX:
${resumeContent}

${customMessage ? "Additional Instructions from User: " + customMessage : ""}

Provide the updated resume in LaTeX format, ensuring all LaTeX syntax is correct and compilable.
`;

  try {
    const completion = await openai.createCompletion({
      model: "text-davinci-003",
      prompt: prompt,
      max_tokens: 2048,
      temperature: 0.7,
    });

    let updatedResume = completion.data.choices[0].text.trim();
    // Validate LaTeX code using chktex
    const tempFile = tmp.fileSync({ postfix: ".tex" });
    fs.writeFileSync(tempFile.name, updatedResume);

    exec(`chktex ${tempFile.name}`, (err, stdout, stderr) => {
      tempFile.removeCallback();

      if (err) {
        console.error("LaTeX validation error:", stderr);
        return res
          .status(400)
          .json({
            error: "LaTeX validation failed. Please check your LaTeX code.",
          });
      }

      // If no errors, send the updated resume
      res.json({ updatedResume });
    });
  } catch (error) {
    console.error(
      "OpenAI API error:",
      error.response ? error.response.data : error.message
    );
    res.status(500).json({ error: "Failed to process the request." });
  }
});

app.listen(port, () => {
  console.log(`Backend server is running at http://localhost:${port}`);
});
