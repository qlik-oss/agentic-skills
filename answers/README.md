# Qlik Answers skills

Skills in this folder run inside Qlik Answers, not in a coding agent. You upload a skill to a Qlik Answers app or assistant in Qlik Cloud, and it changes how Qlik Answers responds there.

They use the same SKILL.md format as the agent plugins but are not included in them.

**Before you use these skills**

These skills are community examples, shared as a starting point. They are not official Qlik product features, and Qlik Support does not cover them.

- **No guarantee a skill is applied.** Qlik Answers decides when to load a skill from the question and the skill's `description`. It may skip a skill for some questions. Results can also change when the model or Qlik Answers is updated.
- **General, not tailored to your app.** The skills don't reference any field names, but nobody has tested them on your app. Your data model, master items and other skills can change how they behave.
- **Test thoroughly before others use them.** Run each skill against the questions your users actually ask. Include unusual questions and questions the skill should not affect. Check the numbers against the app, not only the wording. Test again after you change the skill, the app or the model.
- **Keep the set small.** Every skill adds instructions that Qlik Answers has to weigh. Too many skills, or skills that overlap or contradict each other, make answers less predictable. Start with one, add others one at a time, and remove any that don't clearly help. Qlik Cloud also limits how many skills one app can have.
- **You are responsible for the result.** Read the skill text, adapt it to your context, and roll it out the way you would any other change to a production app.

**Skills**

- [qlik-answers-stay-on-topic](skills/qlik-answers-stay-on-topic/): answers only from the app's data and declines general-knowledge questions.
- [qlik-answers-executive-brief](skills/qlik-answers-executive-brief/): answer and number first, up to three bullets, under 60 words.
- [qlik-answers-green-charts](skills/qlik-answers-green-charts/): every chart and KPI in one solid green.
- [qlik-answers-ignore-selections](skills/qlik-answers-ignore-selections/): calculates on all data and ignores the user's current selections, unless the question asks for them.

None of them reference field names, so you can use them in any app. You can use several on the same app, but see **Keep the set small** above.

**Use one**

1. Open the skill folder and copy the `SKILL.md` file.
2. In Qlik Cloud, add it as a skill on your Qlik Answers app or assistant.
3. Test it with the questions your users ask, and check the answers against the examples in the skill's README.

**Write your own**

Start from `template/skill/`, put the folder in `answers/skills/<your-skill-name>/` and follow [CONTRIBUTING.md](../CONTRIBUTING.md). The `description` decides when Qlik Answers loads the skill, so list the questions it should apply to.
