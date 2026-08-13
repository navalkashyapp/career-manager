import { describe, it, expect, vi } from 'vitest';
import { MatchScorerAgent } from '../agents/MatchScorerAgent';
import { MatchScorerInput } from '../types/careerOpsTypes';

// Mock the generateStructuredContent method of BaseAgent to avoid real API calls during tests
vi.mock('../../agents/BaseAgent', () => {
  return {
    BaseAgent: class {
      constructor(protected aiClient: any) {}
      
      async generateStructuredContent(prompt: string): Promise<any> {
        // Return a mocked JSON object that matches the expected output schema
        return {
          overallScore: 4.5,
          grades: {
            skillAlignment: "Strong match on React and TypeScript.",
            cultureFit: "Good match based on startup experience.",
            compensationMatching: "Within expected range.",
            growthPotential: "Clear path to Senior Engineer."
          },
          jobTitle: "Frontend Engineer",
          companyName: "TechCorp",
          jobSummary: "A frontend role focusing on React.",
          gapAnalysis: ["Missing GraphQL experience, but has REST API experience."],
          verdict: "Highly recommended to apply."
        };
      }
    }
  };
});

describe('MatchScorerAgent', () => {
  it('should return structured evaluation results', async () => {
    // Pass null as mock AI client since generateStructuredContent is mocked
    const agent = new MatchScorerAgent(null as any);
    
    const mockInput: MatchScorerInput = {
      userProfile: {
        id: '1',
        fullName: 'Jane Doe',
        targetTitle: 'Frontend Engineer',
        location: 'Remote',
        preferredCompensation: '100k',
        linkedinUrl: '',
        portfolioUrl: '',
        careerHistory: [],
        coreSkills: {
          cloudInfrastructure: [],
          programmingLanguages: ['TypeScript'],
          frameworks: ['React'],
          certifications: [],
          programMethodologies: []
        },
        projects: []
      },
      cvText: 'Jane Doe - Frontend Engineer with 5 years of React experience.',
      jobDescription: 'Frontend Engineer at TechCorp. Must know React and TypeScript.'
    };

    const result = await agent.evaluate(mockInput);
    
    expect(result).toBeDefined();
    expect(result.overallScore).toBe(4.5);
    expect(result.companyName).toBe('TechCorp');
    expect(result.gapAnalysis).toContain('Missing GraphQL experience, but has REST API experience.');
  });
});
