import { BaseAgent } from './BaseAgent';
import { Type, Schema } from '@google/genai';
import { UserProfile } from './ResumeTailorAgent';
import { GEMINI_MODELS } from '../config/gemini';
import { callGeminiApi } from '../lib/utils/geminiClient';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type OutreachChannel = 'linkedin-connection-note' | 'linkedin-dm' | 'cold-email';

export interface RecipientContext {
  name: string;
  role: string;
  company: string;
  /** Shared school, past employer, mutual connection — the warmest open. */
  mutualConnection?: string;
  /** Recent launch, post, funding, talk — a specific reason to write NOW. */
  trigger?: string;
}

/** Hard limits per channel. The model must respect them, not approximate. */
const CHANNEL_LIMITS: Record<
  OutreachChannel,
  { subjectMax?: number; bodyMaxChars: number; bodyMaxWords: number; followUp: boolean }
> = {
  'linkedin-connection-note': { bodyMaxChars: 300, bodyMaxWords: 60, followUp: false },
  'linkedin-dm': { bodyMaxChars: 800, bodyMaxWords: 130, followUp: false },
  'cold-email': { subjectMax: 50, bodyMaxChars: 900, bodyMaxWords: 120, followUp: true },
};

const BANNED_OPENERS = [
  'I hope this email finds you well',
  'I hope you are doing well',
  'I came across your profile',
  'To whom it may concern',
  'My name is',
  'I am writing to express my interest',
  'I would love to pick your brain',
];

export interface OutreachVariant {
  /** The angle: shared-connection, specific-work, role-value. */
  angle: string;
  subject?: string;
  body: string;
  /** One clear ask. */
  cta: string;
}

export interface OutreachAssessment {
  angle: string;
  /** Would a busy hiring manager actually reply? */
  wouldReply: boolean;
  notes: string;
}

export interface OutreachDraft {
  channel: OutreachChannel;
  variants: OutreachVariant[];
  /** Cold email only: the one follow-up, 4-5 days later, shorter than the first. */
  followUp?: OutreachVariant;
  assessments: OutreachAssessment[];
  recommendedVariant: string;
}

const variantSchema = {
  type: Type.OBJECT,
  properties: {
    angle: { type: Type.STRING },
    subject: { type: Type.STRING },
    body: { type: Type.STRING },
    cta: { type: Type.STRING },
  },
  required: ['angle', 'body', 'cta'],
};

const DRAFT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    variants: { type: Type.ARRAY, items: variantSchema },
    followUp: variantSchema,
  },
  required: ['variants'],
};

const ASSESSED_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    channel: { type: Type.STRING },
    variants: { type: Type.ARRAY, items: variantSchema },
    followUp: variantSchema,
    assessments: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          angle: { type: Type.STRING },
          wouldReply: { type: Type.BOOLEAN },
          notes: { type: Type.STRING },
        },
        required: ['angle', 'wouldReply', 'notes'],
      },
    },
    recommendedVariant: { type: Type.STRING },
  },
  required: ['channel', 'variants', 'assessments', 'recommendedVariant'],
};

export class OutreachAgent extends BaseAgent {
  protected getSystemPrompt(): string {
    return `
You write outreach that gets replies. You have seen thousands of cold messages;
the ones that work share three traits: short, specific, and easy to answer.

ANTI-SLOP WRITING v4.1 GUIDELINES
- Write for the reader and the requested purpose. Avoid generic padding, canned openings and conclusions, empty praise, fake specificity, and chat scaffolding.
- Check who performs each action. Name an agent when it matters.
- Check that an introductory or trailing modifier attaches to the intended person or thing.
- Keep the tone requested. Remove unsolicited hype, reassurance, excessive praise, or snark.
- Keep facts, numbers, citations, and uncertainty grounded in supplied sources. Never invent personal experience or details to make writing seem human.
- Review repetition, stock contrasts, padding, repetitive cadence, and generic wrap-ups. Revise only where they weaken clarity or voice.
- Vary sentence and paragraph rhythm naturally. Do not add errors, fragments, or awkwardness to imitate a person.
- Remove unrequested chat or reasoning scaffolding from the deliverable.

WRITING RULES
- Open with the most specific true thing: a mutual connection, their recent
  launch/post/talk, or the exact role and why you fit it. Never open with
  yourself.
- One idea per message. One ask per message. The ask must be answerable in
  under a minute ("open to a 15-min chat next week?" beats "let me know your
  thoughts").
- Sound like a person, not a sequence. Contractions are fine. Exclamation
  marks: max one per message.
- BANNED openers — never use them or anything shaped like them:
  ${BANNED_OPENERS.join('; ')}.
- Never flatter ("I'm so impressed by your incredible journey"). Specific
  observation beats compliment.
- Respect the channel limits exactly. A LinkedIn connection note over 300
  characters does not send.
    `.trim();
  }

  protected getResponseSchema(): Schema {
    return ASSESSED_SCHEMA;
  }

  public async generateOutreach(opts: {
    userProfile: UserProfile;
    cvText: string;
    jobDescription: string;
    recipient: RecipientContext;
    channel: OutreachChannel;
  }): Promise<OutreachDraft> {
    const { userProfile, cvText, jobDescription, recipient, channel } = opts;
    const limits = CHANNEL_LIMITS[channel];

    if (!recipient.name || !recipient.role) {
      throw new Error('Recipient name and role are required — never send outreach to "there".');
    }

    /* Pass 1: draft 3 variants with distinct angles. */
    const draftPrompt = `
Write 3 outreach variants for this candidate to send to the recipient below.

CHANNEL: ${channel}
LIMITS: body max ${limits.bodyMaxChars} chars / ${limits.bodyMaxWords} words${
      limits.subjectMax ? `, subject max ${limits.subjectMax} chars` : ', no subject line'
    }

CANDIDATE: ${JSON.stringify(userProfile)}
CV (source of true claims only): ${cvText}
TARGET ROLE / JD: ${jobDescription}

RECIPIENT:
- Name: ${recipient.name}
- Role: ${recipient.role} at ${recipient.company}
${recipient.mutualConnection ? `- Mutual connection: ${recipient.mutualConnection}` : ''}
${recipient.trigger ? `- Timely trigger: ${recipient.trigger}` : ''}

The 3 variants must take DIFFERENT angles:
1. shared-connection — lead with the mutual link (only if one exists; otherwise
   use the trigger).
2. specific-work — reference something concrete they shipped, wrote, or said.
3. role-value — the candidate's single most relevant proof for the open role.

Each variant: angle, ${limits.subjectMax ? 'subject, ' : ''}body, cta.
${
  limits.followUp
    ? 'Also write ONE follow-up for 4-5 days later: shorter, references the first note, adds one new piece of value or information, same single ask.'
    : 'No follow-up for this channel.'
}
Rules: open specific, one idea, one easy ask, respect limits exactly, no banned openers.
    `.trim();

    const draft = await this.generateStructuredContent<{
      variants: OutreachVariant[];
      followUp?: OutreachVariant;
    }>(draftPrompt, { schema: DRAFT_SCHEMA });

    /* Pass 2: red-team the drafts as the recipient. */
    const assessPrompt = `
You are ${recipient.name}, a ${recipient.role} who gets 20+ cold messages a week.
You delete most in under 5 seconds. Review these drafts honestly.

${JSON.stringify(draft, null, 2)}

For EACH variant (and the follow-up if present): would you reply? Why or why
not — in 2-3 sentences. Judge on: specificity of the open, length vs the
channel, whether the ask is easy, and whether it sounds like a human or a
sequence. Then name the single variant you would actually send.
Return the original variants unchanged plus your assessments.
    `.trim();

    return this.generateStructuredContent<OutreachDraft>(assessPrompt, {
      systemPrompt: 'You are a blunt, experienced hiring manager reviewing cold outreach.',
      schema: ASSESSED_SCHEMA,
    });
  }

  /* ----------------- multi-step modal pipeline methods ------------ */
  public async extractJobDescription(
    jdText: string,
    onRetry?: (
      attempt: number,
      delayMs: number,
      timeElapsedMs: number,
      maxTimeoutMs: number,
    ) => void,
  ): Promise<string> {
    const extractPrompt = `
You are an expert technical recruiter and text analyst.
I have a raw job description that may contain noise, boilerplate, EEO statements, or formatting artifacts.
Extract ALL core job responsibilities, ALL required and preferred tech stack/skills, and ALL key company details. 
Do NOT omit any technical requirements or role expectations. Return a comprehensive, clean version of the actual job without the noise. Do not include a conversational preamble.

RAW JOB DESCRIPTION:
${jdText}
    `;

    console.log(
      '\n=== GEMINI REQUEST (Extract Job) ===\n',
      extractPrompt,
      '\n=================================\n',
    );
    const extractedJdResponse = await callGeminiApi({
      model: GEMINI_MODELS.FLASH,
      contents: extractPrompt,
      config: { maxOutputTokens: 8192 },
      maxTimeoutMs: 120000,
      onRetry,
    });

    console.log(
      '\n=== GEMINI RESPONSE (Extract Job) ===\n',
      extractedJdResponse.text,
      '\n==================================\n',
    );
    return extractedJdResponse.text;
  }

  public async generateMessage(
    cleanedJd: string,
    profileData: any,
    messageType: string,
    onRetry?: (
      attempt: number,
      delayMs: number,
      timeElapsedMs: number,
      maxTimeoutMs: number,
    ) => void,
  ): Promise<{ subject: string; body: string; suggestions: string }> {
    const prompt = `
You are an expert technical recruiter and executive career strategist.
Draft a high-conversion, professional cold outreach message for this candidate to send regarding this job opening.

Message Objective: ${messageType}

CANDIDATE PROFILE:
${JSON.stringify(profileData, null, 2)}

CLEAN JOB DESCRIPTION:
${cleanedJd}

Rules:
1. Subject line must be punchy, relevant, and avoid sounding like marketing spam.
2. Message body must be crisp, authentic, and under 150 words total.
3. Hook them with a direct achievement from the candidate profile that matches a core requirement in the JD.
4. Professional, humble, but confident tone. End with a low-friction call-to-action (e.g. "Would you be open to a 10-minute chat next week?").
5. Provide 1-2 suggestions for the user to further improve this message manually (e.g. adding a specific personal detail).
6. ANTI-SLOP WRITING v4.1: Avoid generic padding, canned openings and conclusions, empty praise, fake specificity, and chat scaffolding.
7. ANTI-SLOP WRITING v4.1: Keep the tone requested. Remove unsolicited hype, reassurance, excessive praise, or snark. Vary sentence rhythm naturally. Never invent personal experience or details to make writing seem human.

Return the result as a JSON object with this structure:
{
  "subject": "string",
  "body": "string",
  "suggestions": "string"
}
    `.trim();

    console.log(
      '\n=== GEMINI REQUEST (Generate Message) ===\n',
      prompt,
      '\n====================================\n',
    );
    const response = await callGeminiApi({
      model: GEMINI_MODELS.FLASH,
      contents: prompt,
      config: { responseMimeType: 'application/json' },
      maxTimeoutMs: 600000,
      onRetry,
    });

    console.log(
      '\n=== GEMINI RESPONSE (Generate Message) ===\n',
      response.text,
      '\n=====================================\n',
    );
    const rawText = response.text || '{}';
    let cleaned = rawText
      .replace(/^\s*```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();
    let extracted = this.extractJsonObject(cleaned);
    try {
      return JSON.parse(extracted || cleaned);
    } catch (e) {
      return JSON.parse(cleaned); // let it throw the real error
    }
  }

  public async draft(
    payload: any,
    onRetry?: (
      attempt: number,
      delayMs: number,
      timeElapsedMs: number,
      maxTimeoutMs: number,
    ) => void,
  ): Promise<any> {
    const { jdText, profileData, messageType, cleanedJdJson } = payload;
    let cleanedJd: string;
    if (cleanedJdJson) {
      cleanedJd =
        typeof cleanedJdJson === 'string' ? cleanedJdJson : JSON.stringify(cleanedJdJson, null, 2);
    } else {
      cleanedJd = await this.extractJobDescription(jdText, onRetry);
    }
    const message = await this.generateMessage(cleanedJd, profileData, messageType, onRetry);
    return {
      draft: message,
      critique: 'Self-critique removed for performance.',
      finalMessage: {
        subject: message.subject,
        body: message.body,
      },
      suggestions: message.suggestions,
    };
  }
}
