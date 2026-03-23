import { useState } from 'react';
import { Idea, ExpertVetting } from '../types';
import { 
  generateFullActionPlan, 
  explainPlanSection, 
  generateBuildWithMe, 
  generateValidationToolkit, 
  generateExpertVetting 
} from '../services/geminiService';

export function useIdeaActions(idea: Idea, onUpdateIdea?: (idea: Idea) => void) {
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isGeneratingBuild, setIsGeneratingBuild] = useState(false);
  const [isGeneratingValidation, setIsGeneratingValidation] = useState(false);
  const [isVetting, setIsVetting] = useState(false);
  const [vettingResult, setVettingResult] = useState<ExpertVetting | null>(idea.expertVetting || null);
  const [explainingSection, setExplainingSection] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<{ section: string; text: string } | null>(null);

  const handleGenerateFullPlan = async () => {
    setIsGeneratingPlan(true);
    try {
      const plan = await generateFullActionPlan(idea);
      const updatedIdea = {
        ...idea,
        fullActionPlan: {
          ...plan,
          generatedAt: new Date().toISOString()
        }
      };
      onUpdateIdea?.(updatedIdea);
      return true;
    } catch (error) {
      console.error("Failed to generate full plan:", error);
      alert("Failed to generate full plan. Please try again.");
      return false;
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleGenerateBuild = async () => {
    setIsGeneratingBuild(true);
    try {
      const build = await generateBuildWithMe(idea);
      onUpdateIdea?.({
        ...idea,
        buildWithMe: { ...build, generatedAt: new Date().toISOString() }
      });
      return true;
    } catch (error) {
      console.error("Failed to generate build toolkit:", error);
      return false;
    } finally {
      setIsGeneratingBuild(false);
    }
  };

  const handleGenerateValidation = async () => {
    setIsGeneratingValidation(true);
    try {
      const validation = await generateValidationToolkit(idea);
      onUpdateIdea?.({
        ...idea,
        validationToolkit: { ...validation, generatedAt: new Date().toISOString() }
      });
      return true;
    } catch (error) {
      console.error("Failed to generate validation toolkit:", error);
      return false;
    } finally {
      setIsGeneratingValidation(false);
    }
  };

  const handleExplainSection = async (section: string, context: string) => {
    setExplainingSection(section);
    try {
      const text = await explainPlanSection(idea, section, context);
      setExplanation({ section, text });
    } catch (error) {
      console.error("Failed to explain section:", error);
    } finally {
      setExplainingSection(null);
    }
  };

  const handleExpertVetting = async () => {
    setIsVetting(true);
    try {
      const result = await generateExpertVetting(idea);
      setVettingResult(result);
      onUpdateIdea?.({
        ...idea,
        expertVetting: result
      });
      return true;
    } catch (error) {
      console.error("Failed to vet idea:", error);
      return false;
    } finally {
      setIsVetting(false);
    }
  };

  return {
    isGeneratingPlan,
    isGeneratingBuild,
    isGeneratingValidation,
    isVetting,
    vettingResult,
    explainingSection,
    explanation,
    setExplanation,
    handleGenerateFullPlan,
    handleGenerateBuild,
    handleGenerateValidation,
    handleExplainSection,
    handleExpertVetting
  };
}
