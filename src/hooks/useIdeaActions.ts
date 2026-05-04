import { useState, useRef, useEffect } from 'react';
import { Idea, ExpertVetting } from '../types';
import {
  generateFullActionPlan,
  explainPlanSection,
  generateBuildWithMe,
  generateValidationToolkit,
  generateExpertVetting,
} from '../services/geminiService';

export function useIdeaActions(idea: Idea, onUpdateIdea?: (idea: Idea) => void) {
  const ideaRef = useRef(idea);
  
  // Sync ref whenever idea prop changes
  useEffect(() => {
    ideaRef.current = idea;
  }, [idea]);

  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isGeneratingBuild, setIsGeneratingBuild] = useState(false);
  const [isGeneratingValidation, setIsGeneratingValidation] = useState(false);
  const [isVetting, setIsVetting] = useState(false);
  const [vettingResult, setVettingResult] = useState<ExpertVetting | null>(
    idea.expertVetting || null
  );
  const [explainingSection, setExplainingSection] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<{ section: string; text: string } | null>(null);
  // FIX (U-1): Track action errors so the UI can surface them instead of silently failing
  const [actionError, setActionError] = useState<string | null>(null);

  const clearActionError = () => setActionError(null);

  const handleError = (error: any, fallback: string) => {
    console.error(fallback, error);
    if (typeof error === 'string') {
      setActionError(error);
    } else if (error?.message) {
      // If message is an object (like Zod issues), stringify it or take a generic message
      if (typeof error.message === 'string') {
        setActionError(error.message);
      } else {
        setActionError(JSON.stringify(error.message));
      }
    } else {
      setActionError(fallback);
    }
  };

  const handleGenerateFullPlan = async (refresh?: boolean) => {
    setIsGeneratingPlan(true);
    setActionError(null);
    try {
      const plan = await generateFullActionPlan(idea, refresh);
      const updatedIdea = {
        ...ideaRef.current,
        fullActionPlan: { ...plan, generatedAt: new Date().toISOString() },
      };
      setIsGeneratingPlan(false);
      onUpdateIdea?.(updatedIdea);
      return true;
    } catch (error: any) {
      handleError(error, 'Failed to generate action plan. Please try again.');
      setIsGeneratingPlan(false);
      return false;
    }
  };

  const handleGenerateBuild = async (refresh?: boolean) => {
    setIsGeneratingBuild(true);
    setActionError(null);
    try {
      const build = await generateBuildWithMe(idea, refresh);
      setIsGeneratingBuild(false);
      onUpdateIdea?.({
        ...ideaRef.current,
        buildWithMe: { ...build, generatedAt: new Date().toISOString() },
      });
      return true;
    } catch (error: any) {
      handleError(error, 'Failed to generate build toolkit. Please try again.');
      setIsGeneratingBuild(false);
      return false;
    }
  };

  const handleGenerateValidation = async (refresh?: boolean) => {
    setIsGeneratingValidation(true);
    setActionError(null);
    try {
      const validation = await generateValidationToolkit(idea, refresh);
      setIsGeneratingValidation(false);
      onUpdateIdea?.({
        ...ideaRef.current,
        validationToolkit: { ...validation, generatedAt: new Date().toISOString() },
      });
      return true;
    } catch (error: any) {
      handleError(error, 'Failed to generate validation toolkit. Please try again.');
      setIsGeneratingValidation(false);
      return false;
    }
  };

  const handleExplainSection = async (section: string, context: string) => {
    setExplainingSection(section);
    setActionError(null);
    try {
      const text = await explainPlanSection(idea, section, context);
      setExplanation({ section, text });
    } catch (error: any) {
      handleError(error, 'Explanation unavailable. Please try again.');
    } finally {
      setExplainingSection(null);
    }
  };

  const handleExpertVetting = async (refresh?: boolean) => {
    setIsVetting(true);
    setActionError(null);
    try {
      const result = await generateExpertVetting(idea, refresh);
      setVettingResult(result);
      onUpdateIdea?.({ ...ideaRef.current, expertVetting: result });
      return true;
    } catch (error: any) {
      handleError(error, 'Expert vetting failed. Please try again.');
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
