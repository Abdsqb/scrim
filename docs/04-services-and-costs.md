# Services and costs

Checked on 2026-10-10. Prices and versions change, so re-check before relying on any number here. Links are in `08-sources.md`.

The full product needs eleven outside services, and most are free at this scale. The first working version needs only a model API key, a free Cloudflare account and a GitHub repository.

## How the pieces connect

```
 Desktop app (Electron, Windows first)
   captures the screen, plays the moves, shows equations with KaTeX
        │  every request
        ▼
 Your server (Cloudflare Worker)
   holds every API key, checks who is asking, limits use per person
        ├──> Claude Haiku 5.5     the director and reader model
        ├──> AssemblyAI           speech to text, streamed
        └──> ElevenLabs           premium voice, optional

 Added once other people use it:
   installer (GitHub Releases, Azure signing), usage reports (PostHog),
   accounts (Supabase), payments (Lemon Squeezy)
```

No API key ships inside the app. The voice built into Windows runs on the PC and needs no service.

## Inside the app

All free and open source.

| Part | Library | Version | What to know |
| --- | --- | --- | --- |
| App shell | Electron | 44.7.0 | Capture, hotkeys and windows are built in. One codebase for Windows and Mac |
| Screen capture | Electron `desktopCapturer` | built in | Main process only |
| Hotkey | Electron `globalShortcut` | built in | Fires on press. Does not report release |
| Hold to talk | uiohook-napi | 1.5.5 | Reports press and release. Ships a ready-built Windows x64 file. Not yet a dependency |
| Equations | KaTeX | 0.19.0 | In use |
| Installer | electron-builder | 26.15.3 | Not yet a dependency |
| Updates | electron-updater | 6.8.9 | Reads GitHub releases. Not yet a dependency |
| Server tooling | Wrangler | 4.149.0 | Deploys the Cloudflare Worker |

Tauri is a lighter alternative to Electron with a much smaller download. It was not evaluated hands-on. Revisit only after version one works.

## Outside services

| Job | Service | Free allowance | Paid price | Needed from |
| --- | --- | --- | --- | --- |
| Director and reader model | Claude Haiku 5.5, Anthropic API | A small credit for new accounts | $0.10 per million tokens in, $0.50 out | Phase 1 |
| Server that holds keys | Cloudflare Workers | 100,000 requests a day | $5 a month for 10 million requests | Phase 1 |
| Code, downloads, updates | GitHub | Free | None | Phase 1 |
| Speech to text | AssemblyAI Universal-Streaming | Up to 333 hours of streaming | $0.15 per hour | Phase 2 |
| Premium voice, optional | ElevenLabs Flash | 20,000 characters | $0.04 per 1,000 characters | Phase 2 |
| Usage and crash reports | PostHog | 1 million events and 100,000 errors a month | Usage based | Phase 3 |
| Windows code signing | Azure Artifact Signing | None | $9.99 a month, as reported in January 2026 | Phase 4 |
| Accounts and usage limits | Supabase | 50,000 monthly users, 500 MB | $25 a month | Phase 4 |
| Domain | GitHub Student Developer Pack | One domain free for a year | Renewal price not checked | Phase 4 |
| Payments | Lemon Squeezy | No monthly fee | 5% plus 50 cents per sale | Phase 5 |
| Mac code signing | Apple Developer Program | None | $99 a year | When building for Mac |

**Why these.** Clicky's open-source version uses the same core: Claude, AssemblyAI and ElevenLabs behind a Cloudflare Worker. Its `worker` folder is a reference for the server. Its app is Swift and Mac-only, so that part does not carry over.

**Alternatives**

- **Model.** Claude Sonnet 5.5 costs $2 in and $10 out per million tokens, about twenty times Haiku per scene. Move up only if Haiku matches terms to the wrong lines. Gemini Flash is the main outside alternative, and third-party pages disagreed on its price. Choose by measuring time to first move and accuracy on twenty real scenes. Keep the server able to switch providers.
- **Speech to text.** Deepgram, known for low delay.
- **Payments.** Stripe charges 2.9% plus 30 cents per card payment, plus 0.7% for subscriptions, and leaves sales tax to the seller. Lemon Squeezy costs more per sale and handles the tax as seller of record.
- **Student perks.** The GitHub Student Developer Pack lists $100 of Azure credit. Check that a student subscription is accepted for the identity check that signing requires.

## Model settings that matter

For Claude Haiku 5.5, model id `claude-haiku-5-5`:

- It thinks before answering by default, at medium effort. Set effort to low for the director and measure time to first move.
- Leave out `temperature`, `top_p` and `top_k`. The documentation says some values return an error.
- Instructions can be cached once they pass 512 tokens, and cached input costs a tenth of the normal price. Keep the move list and rules in one fixed block at the start of every request.
- Images cost about `ceil(width / 28) × ceil(height / 28)` tokens. A full 1080p screenshot is 2,691. Two boxed pieces are a few hundred at most.
- New accounts can start with lower limits than published. The standard starting tier allows 1,000 requests a minute and $500 a month.
- A monthly spend limit can be set in the console below the account's cap. Set one on day one.

## Cost

A five-question scene costs about a third of a cent with the built-in voice and about 7 cents with a paid voice. The paid voice is 95% of the total.

| Part of one five-question scene | Cost |
| --- | --- |
| Model, Claude Haiku 5.5 | $0.0016 |
| Speech to text | $0.0017 |
| Paid voice, ElevenLabs Flash | $0.064 |

Per month, at five scenes a day for each user:

| Users | Scenes a month | Model and speech in | With paid voice added |
| --- | --- | --- | --- |
| 5 | 750 | $2.44 | $50 |
| 100 | 15,000 | $49 | $1,009 |
| 1,000 | 150,000 | $488 | $10,088 |

About $0.49 per user per month without paid voice, and about $10 with it.

**What follows**

- Ship with captions and the built-in Windows voice. Offer the premium voice later as a paid extra.
- At 100 users, speech to text is about 167 hours a month, so the free 333 hours last about two months at that size.

**Assumptions.** Two cropped pieces per scene, 8 seconds of speech per question, 320 spoken characters per answer, about 450 output tokens per turn including thinking. These are estimates. The cost model is in `prototype/test_core.js`. Replace the assumptions with measured numbers once the director exists.

## When to sign up for what

Nothing has a fixed monthly cost until phase 4.

| Phase | Goal | Open | Fixed cost |
| --- | --- | --- | --- |
| 1 | The scene works with a typed question | Anthropic API key, Cloudflare account, GitHub repository | $0, plus cents of model use |
| 2 | Voice and follow-up questions | AssemblyAI. ElevenLabs only to compare | $0 |
| 3 | Five classmates use it for a week | PostHog. An unsigned installer on GitHub Releases | $0 |
| 4 | Anyone can download it | Azure Artifact Signing, a domain, Supabase sign-in, a daily limit per person | About $10 a month |
| 5 | People pay | Lemon Squeezy | A fee per sale |
| Later | A Mac version | Apple Developer Program and access to a Mac | $99 a year |

## Windows first

The owner's PC runs Windows on x64. Clicky is Mac-only with Windows on a waitlist, so Windows is also the open lane.

- **No capture permission prompt.** Electron reports screen access as always granted on Windows. Mac will need a screen recording permission step.
- **Unsigned installers get a warning** from Windows. Acceptable for five classmates, not for strangers.
- **Signing as an individual.** Azure Artifact Signing accepts individual developers in the United States and Canada, checked against a government ID and the Azure billing account.
- **Scaling.** Capture at the real pixel size: reported size times the display's scale factor. Tested at 100% only. Many laptops run at 125% or 150%.
- **More than one monitor.** Capture and cover the display the cursor is on. Only the primary display is handled today.

## What to watch for

**Keys and spending**

- An open server is a free model for strangers. Before phase 4 it must check a sign-in token and enforce a daily limit per person.

**Privacy**

- Say plainly in the app what leaves the PC: the boxed pieces go to the model provider and voice audio goes to the speech provider.
- Anthropic's documentation says images sent through the API are not used to train models and are deleted after processing. Read AssemblyAI's and ElevenLabs' terms before phase 3.
- Lecture slides and exams belong to professors. Do not store captured pieces on the server or share them between users.

**Free plans**

- Supabase pauses free projects after a week without activity.
- AssemblyAI's free plan allows five new streaming connections a minute.

## Numbers that need a second look

- The Azure signing price is from a January 2026 news article. Microsoft's pricing page showed no number when opened.
- Gemini Flash prices came from third-party pages that disagreed, so Gemini is not in the cost table.
- The ElevenLabs free amount is read from its pricing table and is not stated in words on the page.
