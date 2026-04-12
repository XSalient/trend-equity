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
  // FIX (U-1): Track action errors so the UI can surface them instead of silently failing
  const [actionError, setActionError] = useState<string | null>(null);

  const clearActionError = () => setActionError(null);

  const handleGenerateFullPlan = async () => {
    setIsGeneratingPlan(true);
    setActionError(null);
    try {
      const plan = await generateFullActionPlan(idea);
      const updatedIdea = {
        ...idea,
        fullActionPlan: { ...plan, generatedAt: new Date().toISOString() }
      };
      onUpdateIdea?.(updatedIdea);
      return true;
    } catch (error: any) {
      console.error("Failed to generate full plan:", error);
      // FIX (U-1, U-7): Set error state instead of using alert()
      setActionError(error?.message || "Failed to generate action plan. Please try again.");
      return false;
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleGenerateBuild = async () => {
    setIsGeneratingBuild(true);
    setActionError(null);
    try {
      const build = await generateBuildWithMe(idea);
      onUpdateIdea?.({
        ...idea,
        buildWithMe: { ...build, generatedAt: new Date().toISOString() }
      });
      return true;
    } catch (error: any) {
      console.error("Failed to generate build toolkit:", error);
      // FIX (U-1): Previously swallowed silently — now surfaces to the user
      setActionError(error?.message || "Failed to generate build toolkit. Please try again.");
      return false;
    } finally {
      setIsGeneratingBuild(false);
    }
  };

  const handleGenerateValidation = async () => {
    setIsGeneratingValidation(true);
    setActionError(null);
    try {
      const validation = await generateValidationToolkit(idea);
      onUpdateIdea?.({
        ...idea,
        validationToolkit: { ...validation, generatedAt: new Date().toISOString() }
      });
      return true;
    } catch (error: any) {
      console.error("Failed to generate validation toolkit:", error);
      // FIX (U-1): Previously swallowed silently — now surfaces to the user
      setActionError(error?.message || "Failed to generate validation toolkit. Please try again.");
      return false;
    } finally {
      setIsGeneratingValidation(false);
    }
  };

  const handleExplainSection = async (section: string, context: string) => {
    setExplainingSection(section);
    setActionError(null);
    try {
      const text = await explainPlanSection(idea, section, context);
      setExplanation({ section, text });
    } catch (error: any) {
      console.error("Failed to explain section:", error);
      setActionError("Explanation unavailable. Please try again.");
    } finally {
      setExplainingSection(null);
    }
  };

  const handleExpertVetting = async () => {
    setIsVetting(true);
    setActionError(null);
    try {
      const result = await generateExpertVetting(idea);
      setVettingResult(result);
      onUpdateIdea?.({ ...idea, expertVetting: result });
      return true;
    } catch (error: any) {
      console.error("Failed to vet idea:", error);
      // FIX (U-1): Previously swallowed silently — now surfaces to the user
      setActionError(error?.message || "Expert vetting failed. Please try again.");
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
    actionError,
    clearActionError,
    handleGenerateFullPlan,
    handleGenerateBuild,
    handleGenerateValidation,
    handleExplainSection,
    handleExpertVetting,
  };
}
