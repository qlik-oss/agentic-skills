# Qlik Answers skills

Skills in this folder run inside Qlik Answers, not in a coding agent. You upload a skill to a Qlik Answers app or assistant in Qlik Cloud, and it changes how Qlik Answers responds there.

They use the same SKILL.md format and checks as `official/` and `community/`, but no `.claude-plugin` manifest lists them, so they don't install into Claude Code, Cursor or Codex.

**Skills**

- [qlik-answers-stay-on-topic](skills/qlik-answers-stay-on-topic/): answers only from the app's data and declines general-knowledge questions.
- [qlik-answers-executive-brief](skills/qlik-answers-executive-brief/): answer and number first, up to three bullets, under 60 words.
- [qlik-answers-green-charts](skills/qlik-answers-green-charts/): every chart and KPI in one solid green.

None of them reference field names, so they work in any app. You can use all three on the same app.

**Use one**

1. Open the skill folder and copy the `SKILL.md` file.
2. In Qlik Cloud, add it as a skill on your Qlik Answers app or assistant.
3. Ask a few questions and check the answers match the examples in the skill's README.

**Write your own**

Start from `template/skill/`, put the folder in `answers/skills/<your-skill-name>/` and follow [CONTRIBUTING.md](../CONTRIBUTING.md). The `description` decides when Qlik Answers loads the skill, so list the questions it should apply to.
