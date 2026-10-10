# Product

## The pitch

Whatever is on your screen becomes an explainer video you can interrupt. It explains your own material, answers the question you asked, and changes course when you ask another.

Compared with watching a real explainer video:

- It is about your material. A video explains someone else's example. This explains the page you are stuck on.
- It answers your question. A video covers what its creator chose to cover.
- You can talk back. Stop it, ask why, and it changes course.

## The scene version one must do

You are reading typed lecture notes. You hold a key and say "I don't understand how this equation fits into this algorithm."

1. The equation and the algorithm lift off the page.
2. The page shrinks, blurs and goes dark behind them.
3. Each lifted piece turns into live content: the equation as separate terms, the algorithm as numbered lines.
4. Each term takes a color, a copy of it travels to the line it stands for, and a short explanation is shown and spoken.
5. You ask a follow-up, for example "show me with numbers", and the scene changes without starting over.
6. Esc puts everything back.

**Done means:** the scene works start to finish on three different pages of the owner's own course notes, with the first full explanation on screen in under four seconds.

**Left out of version one:** handwriting, video, and finding the pieces automatically. The user drags a box around each piece.

## Who it is for

Students studying from typed notes, slides and textbooks on a computer. The owner is one of them, which is the main advantage: the problem can be observed up close every day.

## Why this, and what the research said

The idea came out of a long search for a real friction in studying. Findings that shaped it:

- **AI that gives answers does not produce learning.** In a University of Pennsylvania experiment, students with ChatGPT got 48% more practice problems right and scored 17% lower on the test afterward. They did not believe their learning had been hurt.
- **Watching a smooth explanation feels like learning when little sticks.** Students consistently favor study methods that feel fluent over ones that work. This is the main risk for this product. The interactive parts are what counter it, so follow-up questions and a quiz mode are essential, not extras.
- **Students do not use AI tutors much on their own.** A Stanford study found average use of two to five minutes a week. Motivation is unsolved, so the product has to be something people reach for, not something they are told to use.
- **The reference product is Clicky**, an assistant that sits by the cursor, sees the screen, and points at things while talking. It spread through short demo clips. It is Mac-only, with Windows on a waitlist as of August 2026. Its open-source version is MIT licensed.
- **Screen-aware assistants are crowded.** A general "AI that sees your screen" will not stand out. What is different here is the presentation: the screen itself is rearranged into an animated explanation.

## Risks

| Risk | What to do about it |
| --- | --- |
| It impresses once and then goes unused | Run the two tests below before building beyond version one |
| The model matches a term to the wrong thing | Show a one-line reason with every match. Stick to typed material. Check twenty scenes by hand and count errors |
| It feels slow | Start local motion immediately so it covers the model's delay. Measure every stage |
| A larger product copies the effect | Stay narrow on course material and improve faster |
| Capturing the screen worries people | Capture only on the hotkey, send only the boxed pieces, and say so plainly |
| Each use costs money | Paid voice is 95% of the cost. Default to captions and the built-in voice |

## How to find out if it is worth continuing

- Use it yourself for two weeks of real studying. Count how many times a day you reach for it in week two.
- Give it to five classmates for a week without reminding them. Note who opens it a second time on their own.

If the owner still uses it in week two and at least two classmates come back to it, keep building. If not, the recording and the code are still a strong portfolio project.

## After version one

Add moves and content types one at a time, in the order people ask for them.

- **Find pieces automatically** from the cursor position and the words "this equation".
- **Quiz mode.** Before revealing a match, ask which line the user thinks a term belongs to. This turns watching into practice.
- **Code in videos.** Pause a coding tutorial, lift a function, step through it.
- **Charts and figures.** Pull a chart apart into its series.
- **Course fit.** Read the course's own rules and notes so explanations follow the method the class uses.
- **Full video.** A "make me a video on this" button that renders a longer piece on a server.

## Parked ideas from the same search

These came up before this one and are not part of this project.

- A coach for code that asks leading questions and refuses to write the code.
- A checker that reviews an assignment against a course's own written rules before submission.
- A learning path into AI-assisted security work, which the owner also wants to pursue.
