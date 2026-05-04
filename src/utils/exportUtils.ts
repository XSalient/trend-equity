import { Idea } from '../types';
import { jsPDF } from 'jspdf';

export const exportToPDF = (idea: Idea, _format: string) => {
  try {
    let doc: any;
    if (typeof jsPDF !== 'function' && typeof (jsPDF as any).jsPDF === 'function') {
      // Handle different build tool import behaviors
      const DocClass = (jsPDF as any).jsPDF;
      doc = new DocClass();
    } else {
      doc = new jsPDF();
    }
    const margin = 20;
    let y = 20;

    const checkPage = (needed: number) => {
      if (y + needed > 280) {
        doc.addPage();
        y = 20;
      }
    };

    const safe = (val: any) => String(val || '');

    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(safe(idea.headline).toUpperCase(), margin, y);
    y += 12;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100);
    doc.text(`TAGS: ${(idea.categoryTags || []).join(', ')}`, margin, y);
    y += 10;

    // Scores & Heat
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129); // Emerald
    doc.text(`SCORE: ${idea.revenuePotentialScore || 0}/10`, margin, y);
    doc.setTextColor(245, 158, 11); // Amber
    doc.text(`HEAT: ${safe(idea.heatBadge) || 'Early Bird'}`, margin + 50, y);
    doc.setTextColor(100);
    doc.text(`SATURATION: ${safe(idea.saturationLabel) || 'Low'}`, margin + 100, y);
    y += 10;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(50);
    const pitchLines = doc.splitTextToSize(`"${safe(idea.pitch)}"`, 170);
    doc.text(pitchLines, margin, y);
    y += pitchLines.length * 6 + 10;

    doc.setDrawColor(200);
    doc.line(margin, y, 190, y);
    y += 10;

    // VC Section
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('VC JUSTIFICATION', margin, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    const vcLines = doc.splitTextToSize(safe(idea.vcJustification), 170);
    doc.text(vcLines, margin, y);
    y += vcLines.length * 5 + 8;

    if (idea.unfairAdvantage) {
      checkPage(20);
      doc.setFont('helvetica', 'bold');
      doc.text('UNFAIR ADVANTAGE', margin, y);
      y += 7;
      doc.setFont('helvetica', 'normal');
      const uaLines = doc.splitTextToSize(safe(idea.unfairAdvantage), 170);
      doc.text(uaLines, margin, y);
      y += uaLines.length * 5 + 10;
    }

    // Next Steps (Action Items)
    if (idea.nextSteps && idea.nextSteps.length > 0) {
      checkPage(40);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 185, 129); // Emerald
      doc.text('IMMEDIATE NEXT STEPS', margin, y);
      y += 8;
      doc.setFontSize(10);
      doc.setTextColor(0);

      (idea.nextSteps || []).forEach((step, i) => {
        const parts = safe(step)
          .split('|')
          .map((s) => s.trim());
        const title = parts[0] || safe(step);
        const timeline = parts[1];
        const risk = parts[2];

        checkPage(15);
        doc.setFont('helvetica', 'bold');
        doc.text(`${i + 1}. ${title}`, margin + 5, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(100);
        let details = '';
        if (timeline) details += `Timeline: ${timeline} | `;
        if (risk) details += `Risk: ${risk}`;
        if (details) {
          doc.text(details, margin + 10, y);
          y += 5;
        }
        doc.setTextColor(0);
        doc.setFontSize(10);
      });
      y += 5;
    }

    // Market & Analysis Row
    checkPage(40);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('MARKET ANALYSIS', margin, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    const analysisY = y;
    let maxColY = y;

    // Column 1: Market Size
    if (idea.marketSize) {
      doc.setFont('helvetica', 'bold');
      doc.text('Market Size:', margin, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      const msLines = doc.splitTextToSize(safe(idea.marketSize), 50);
      doc.text(msLines, margin, y);
      maxColY = Math.max(maxColY, y + msLines.length * 4.5);
    }

    // Column 2: Competitors
    y = analysisY;
    if (idea.competitorLandscape) {
      doc.setFont('helvetica', 'bold');
      doc.text('Competitors:', margin + 60, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      const cLines = doc.splitTextToSize(safe(idea.competitorLandscape), 50);
      doc.text(cLines, margin + 60, y);
      maxColY = Math.max(maxColY, y + cLines.length * 4.5);
    }

    // Column 3: Regulatory
    y = analysisY;
    if (idea.regulatoryFlags) {
      doc.setFont('helvetica', 'bold');
      doc.text('Regulatory:', margin + 120, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      const rLines = doc.splitTextToSize(safe(idea.regulatoryFlags), 50);
      doc.text(rLines, margin + 120, y);
      maxColY = Math.max(maxColY, y + rLines.length * 4.5);
    }

    y = maxColY + 10;
    doc.setFontSize(11);

    // Financials & Exit
    checkPage(30);
    doc.setFont('helvetica', 'bold');
    doc.text('FINANCIALS & EXIT', margin, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.text(`Cost & Effort: ${safe(idea.costEffort)}`, margin, y);
    y += 6;
    const exitLines = doc.splitTextToSize(`Potential Exit: ${safe(idea.potentialExit)}`, 170);
    doc.text(exitLines, margin, y);
    y += exitLines.length * 5 + 8;

    doc.setFont('helvetica', 'bold');
    doc.text('REVENUE MODEL', margin, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    const revLines = doc.splitTextToSize(safe(idea.revenueSkeleton), 170);
    doc.text(revLines, margin, y);
    y += revLines.length * 5 + 10;

    if (idea.expertVetting) {
      checkPage(50);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(245, 158, 11); // Amber-500
      doc.text('EXPERT VETTING', margin, y);
      y += 10;

      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text(
        `VERDICT: ${safe(idea.expertVetting.verdict) || 'Moderate'} (Score: ${idea.expertVetting.score || 50}/100)`,
        margin + 5,
        y
      );
      y += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('STRENGTHS:', margin + 5, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      (idea.expertVetting.strengths || []).forEach((s) => {
        const sLines = doc.splitTextToSize(`- ${safe(s)}`, 160);
        checkPage(sLines.length * 5 + 5);
        doc.text(sLines, margin + 10, y);
        y += sLines.length * 5 + 2;
      });

      y += 4;
      checkPage(20);
      doc.setFont('helvetica', 'bold');
      doc.text('WEAKNESSES:', margin + 5, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      (idea.expertVetting.weaknesses || []).forEach((w, idx) => {
        const wLines = doc.splitTextToSize(`- ${safe(w)}`, 160);
        checkPage(wLines.length * 5 + 10);
        doc.text(wLines, margin + 10, y);
        y += wLines.length * 5 + 2;

        // Add risk mitigation if available
        if (idea.expertVetting?.riskMitigation?.[idx]) {
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(16, 185, 129); // Emerald
          const rmLines = doc.splitTextToSize(
            `Mitigation: ${safe(idea.expertVetting.riskMitigation[idx])}`,
            150
          );
          checkPage(rmLines.length * 5 + 5);
          doc.text(rmLines, margin + 15, y);
          y += rmLines.length * 5 + 3;
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0);
        }
      });

      if (idea.expertVetting.pivotSuggestions && idea.expertVetting.pivotSuggestions.length > 0) {
        y += 4;
        checkPage(20);
        doc.setFont('helvetica', 'bold');
        doc.text('PIVOT SUGGESTIONS:', margin + 5, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        (idea.expertVetting.pivotSuggestions || []).forEach((p) => {
          const pLines = doc.splitTextToSize(`- ${safe(p)}`, 160);
          checkPage(pLines.length * 5 + 5);
          doc.text(pLines, margin + 10, y);
          y += pLines.length * 5 + 2;
        });
      }

      if (idea.expertVetting.comparableExits && idea.expertVetting.comparableExits.length > 0) {
        y += 4;
        checkPage(20);
        doc.setFont('helvetica', 'bold');
        doc.text('COMPARABLE EXITS:', margin + 5, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        doc.text((idea.expertVetting.comparableExits || []).join(', '), margin + 10, y);
        y += 8;
      }
    } else {
      checkPage(30);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(150);
      doc.text('EXPERT VETTING (NOT GENERATED)', margin, y);
      y += 10;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text(
        'Trigger expert vetting in the app to see risk assessment and pivot logic.',
        margin + 5,
        y
      );
      y += 15;
    }

    if (idea.fullActionPlan) {
      doc.addPage();
      y = 20;
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 185, 129); // Emerald-500
      doc.text('EXECUTION ROADMAP', margin, y);
      y += 10;
      doc.setTextColor(0);

      // Timeline Summary
      doc.setFontSize(12);
      doc.text(`PROJECTED TIMELINE: ${safe(idea.fullActionPlan.timeline)}`, margin + 5, y);
      y += 10;

      (idea.fullActionPlan.roadmap || []).forEach((step, i) => {
        const status = step.isDone ? '[DONE] ' : '[ ] ';
        const stepLines = doc.splitTextToSize(safe(step.details), 160);
        checkPage(stepLines.length * 5 + 15);

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`${status}${i + 1}. ${safe(step.step)}`, margin + 5, y);
        y += 6;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(stepLines, margin + 10, y);
        y += stepLines.length * 4.5 + 2;
        doc.setTextColor(100);
        doc.text(`Milestone: ${safe(step.milestone)}`, margin + 10, y);
        y += 7;
        doc.setTextColor(0);
      });

      if (idea.fullActionPlan.tools && idea.fullActionPlan.tools.length > 0) {
        checkPage(20);
        y += 5;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('RECOMMENDED STACK:', margin + 5, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text((idea.fullActionPlan.tools || []).join(', '), margin + 10, y);
        y += 8;
      }

      if (idea.fullActionPlan.risks && idea.fullActionPlan.risks.length > 0) {
        checkPage(25);
        y += 5;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(185, 28, 28); // Red-700
        doc.text('CRITICAL RISKS:', margin + 5, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(0);
        (idea.fullActionPlan.risks || []).forEach((r) => {
          const rLines = doc.splitTextToSize(`- ${safe(r)}`, 160);
          checkPage(rLines.length * 5 + 5);
          doc.text(rLines, margin + 10, y);
          y += rLines.length * 5 + 2;
        });
        y += 5;
      }
    } else {
      doc.addPage();
      y = 20;
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(150);
      doc.text('EXECUTION ROADMAP (NOT GENERATED)', margin, y);
      y += 10;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text(
        'Generate the full action plan to see the detailed step-by-step roadmap.',
        margin + 5,
        y
      );
      y += 15;
    }

    if (idea.buildWithMe) {
      doc.addPage();
      y = 20;
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(99, 102, 241); // Indigo-500
      doc.text('BUILDER PACK (AI PROMPTS)', margin, y);
      y += 10;
      doc.setTextColor(0);

      (idea.buildWithMe.promptPack || []).forEach((p) => {
        const pLines = doc.splitTextToSize(safe(p.prompt), 160);
        checkPage(pLines.length * 5 + 10);

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(safe(p.title), margin + 5, y);
        y += 6;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(80);
        doc.text(pLines, margin + 10, y);
        y += pLines.length * 4.5 + 8;
        doc.setTextColor(0);
      });

      checkPage(30);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('REPOSITORY STRUCTURE', margin + 5, y);
      y += 7;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const repoLines = doc.splitTextToSize(safe(idea.buildWithMe.repoStructure), 160);
      doc.text(repoLines, margin + 10, y);
      y += repoLines.length * 4.5 + 10;

      if (idea.buildWithMe.first24Hours && idea.buildWithMe.first24Hours.length > 0) {
        checkPage(30);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('FIRST 24 HOURS CHECKLIST', margin + 5, y);
        y += 7;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        (idea.buildWithMe.first24Hours || []).forEach((task) => {
          doc.text(`[ ] ${safe(task)}`, margin + 10, y);
          y += 6;
        });
      }
    } else {
      doc.addPage();
      y = 20;
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(150);
      doc.text('BUILDER PACK (NOT GENERATED)', margin, y);
      y += 10;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text(
        'Generate the Build Pack to get ready-to-use AI prompts and repo architecture.',
        margin + 5,
        y
      );
      y += 15;
    }

    if (idea.validationToolkit) {
      doc.addPage();
      y = 20;
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 185, 129); // Emerald-500
      doc.text('VALIDATION TOOLKIT', margin, y);
      y += 10;
      doc.setTextColor(0);

      doc.setFontSize(12);
      doc.text('LANDING PAGE COPY', margin + 5, y);
      y += 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const heroLines = doc.splitTextToSize(
        `Hero: ${safe(idea.validationToolkit.landingPage?.hero)}`,
        160
      );
      doc.text(heroLines, margin + 10, y);
      y += heroLines.length * 5 + 2;

      const subLines = doc.splitTextToSize(
        `Sub-hero: ${safe(idea.validationToolkit.landingPage?.subHero)}`,
        160
      );
      doc.text(subLines, margin + 10, y);
      y += subLines.length * 5 + 5;

      doc.setFont('helvetica', 'bold');
      doc.text('Value Props:', margin + 10, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      (idea.validationToolkit.landingPage?.valueProps || []).forEach((vp) => {
        doc.text(`- ${safe(vp)}`, margin + 15, y);
        y += 6;
      });
      y += 5;

      checkPage(40);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('SMOKE TEST STRATEGY', margin + 5, y);
      y += 7;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const smokeLines = doc.splitTextToSize(safe(idea.validationToolkit.smokeTest), 160);
      doc.text(smokeLines, margin + 10, y);
      y += smokeLines.length * 5 + 10;

      if (
        idea.validationToolkit.successMetrics &&
        idea.validationToolkit.successMetrics.length > 0
      ) {
        checkPage(30);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('SUCCESS METRICS', margin + 5, y);
        y += 7;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        (idea.validationToolkit.successMetrics || []).forEach((m) => {
          doc.text(`• ${safe(m)}`, margin + 10, y);
          y += 6;
        });
        y += 4;
      }

      checkPage(50);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('CUSTOMER INTERVIEW QUESTIONS', margin + 5, y);
      y += 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      (idea.validationToolkit.interviewScript || []).forEach((q, i) => {
        const qLines = doc.splitTextToSize(`${i + 1}. ${safe(q)}`, 160);
        checkPage(qLines.length * 6 + 5);
        doc.text(qLines, margin + 10, y);
        y += qLines.length * 6 + 2;
      });
    } else {
      doc.addPage();
      y = 20;
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(150);
      doc.text('VALIDATION TOOLKIT (NOT GENERATED)', margin, y);
      y += 10;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text(
        'Generate the validation toolkit to see interview scripts and landing page copy.',
        margin + 5,
        y
      );
      y += 15;
    }

    if (idea.trendSources && idea.trendSources.length > 0) {
      checkPage(30);
      y += 10;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('MARKET SOURCES', margin, y);
      y += 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(59, 130, 246); // Blue-500
      (idea.trendSources || []).forEach((source) => {
        const sLines = doc.splitTextToSize(`- ${safe(source)}`, 160);
        checkPage(sLines.length * 5 + 5);
        doc.text(sLines, margin + 5, y);
        y += sLines.length * 5 + 2;
      });
      doc.setTextColor(0);
    }

    doc.setFontSize(9);
    doc.setTextColor(150);
    const footerY = 285;
    doc.text(
      ` 2026 Trend-Equity Intelligence Unit | Generated on ${new Date().toLocaleDateString()}`,
      margin,
      footerY
    );
    doc.text(
      'Confidential Analysis - Builder Tier Access Only',
      190 - doc.getTextWidth('Confidential Analysis - Builder Tier Access Only'),
      footerY
    );

    doc.save(`${safe(idea.headline).replace(/\s+/g, '_')}_TrendEquity_Report.pdf`);
  } catch (err) {
    console.error('PDF Generation failed:', err);
    alert('Failed to generate PDF. Please try again or use the Notion export.');
  }
};

export const generateNotionMarkdown = (idea: Idea): string => {
  let md = `# ${idea.headline}\n\n`;
  md += `**Tags**: ${(idea.categoryTags || []).join(', ')}\n`;
  md += `**Score**: ${idea.revenuePotentialScore}/10 | **Heat**: ${idea.heatBadge} | **Saturation**: ${idea.saturationLabel}\n\n`;
  md += `> ${idea.pitch}\n\n`;

  md += `## VC Justification\n${idea.vcJustification}\n\n`;

  if (idea.unfairAdvantage) {
    md += `## Unfair Advantage\n${idea.unfairAdvantage}\n\n`;
  }

  if (idea.nextSteps && idea.nextSteps.length > 0) {
    md += `## Immediate Next Steps\n`;
    idea.nextSteps.forEach((step, i) => {
      const parts = step.split('|').map((s) => s.trim());
      const title = parts[0] || step;
      const timeline = parts[1];
      const risk = parts[2];
      const tool = parts[3];

      md += `### ${i + 1}. ${title}\n`;
      if (timeline) md += `**Timeline**: ${timeline}  \n`;
      if (risk) md += `**Risk**: ${risk}  \n`;
      if (tool) md += `**Tool**: ${tool}  \n`;
      md += `\n`;
    });
  }

  md += `## Market Analysis\n`;
  if (idea.marketSize) md += `**Market Size**: ${idea.marketSize}\n`;
  if (idea.competitorLandscape) md += `**Competitors**: ${idea.competitorLandscape}\n`;
  if (idea.regulatoryFlags) md += `**Regulatory**: ${idea.regulatoryFlags}\n`;
  md += `\n`;

  md += `## Financials & Exit\n`;
  md += `**Cost & Effort**: ${idea.costEffort}\n`;
  md += `**Potential Exit**: ${idea.potentialExit}\n\n`;

  md += `## Revenue Skeleton\n${idea.revenueSkeleton}\n\n`;

  if (idea.expertVetting) {
    md += `## Expert Vetting\n`;
    md += `**Verdict**: ${idea.expertVetting.verdict} (${idea.expertVetting.score}/100)\n\n`;
    md += `### Strengths\n${idea.expertVetting.strengths.map((s) => `- ${s}`).join('\n')}\n\n`;
    md += `### Weaknesses & Risk Mitigation\n`;
    idea.expertVetting.weaknesses.forEach((w, idx) => {
      md += `- **Weakness**: ${w}\n`;
      if (idea.expertVetting.riskMitigation?.[idx]) {
        md += `  - *Mitigation*: ${idea.expertVetting.riskMitigation[idx]}\n`;
      }
    });
    md += `\n`;
    if (idea.expertVetting.pivotSuggestions) {
      md += `### Pivot Suggestions\n${idea.expertVetting.pivotSuggestions.map((p) => `- ${p}`).join('\n')}\n\n`;
    }
    if (idea.expertVetting.comparableExits) {
      md += `### Comparable Exits\n${idea.expertVetting.comparableExits.join(', ')}\n\n`;
    }
  } else {
    md += `## Expert Vetting (Not Generated)\n*Trigger expert vetting in the app to see risk assessment and pivot logic.*\n\n`;
  }

  if (idea.fullActionPlan) {
    md += `## Execution Roadmap\n`;
    md += `**Timeline**: ${idea.fullActionPlan.timeline}\n\n`;
    idea.fullActionPlan.roadmap.forEach((step, i) => {
      const status = step.isDone ? '[x] ' : '[ ] ';
      md += `### ${i + 1}. ${status}${step.step}\n`;
      md += `${step.details}\n`;
      md += `*Milestone: ${step.milestone}*\n\n`;
    });
    md += `**Recommended Stack**: ${idea.fullActionPlan.tools.join(', ')}\n\n`;
    if (idea.fullActionPlan.risks) {
      md += `### Critical Risks\n${idea.fullActionPlan.risks.map((r) => `- ${r}`).join('\n')}\n\n`;
    }
  } else {
    md += `## Execution Roadmap (Not Generated)\n*Generate the full action plan to see the detailed step-by-step roadmap.*\n\n`;
  }

  if (idea.buildWithMe) {
    md += `## Builder Pack (AI Prompts)\n`;
    idea.buildWithMe.promptPack.forEach((p) => {
      md += `### ${p.title}\n`;
      md += `\`\`\`text\n${p.prompt}\n\`\`\`\n\n`;
    });
    md += `### Repository Structure\n\`\`\`\n${idea.buildWithMe.repoStructure}\n\`\`\`\n\n`;
    if (idea.buildWithMe.first24Hours) {
      md += `### First 24 Hours Checklist\n${idea.buildWithMe.first24Hours.map((t) => `- [ ] ${t}`).join('\n')}\n\n`;
    }
  } else {
    md += `## Builder Pack (Not Generated)\n*Generate the Build Pack to get ready-to-use AI prompts and repo architecture.*\n\n`;
  }

  if (idea.validationToolkit) {
    md += `## Validation Toolkit\n`;
    md += `### Landing Page Copy\n`;
    md += `- **Hero**: ${idea.validationToolkit.landingPage.hero}\n`;
    md += `- **Sub-hero**: ${idea.validationToolkit.landingPage.subHero}\n`;
    md += `- **Value Props**: \n${idea.validationToolkit.landingPage.valueProps.map((vp) => `  - ${vp}`).join('\n')}\n\n`;

    md += `### Smoke Test Strategy\n${idea.validationToolkit.smokeTest}\n\n`;

    if (idea.validationToolkit.successMetrics) {
      md += `### Success Metrics\n${idea.validationToolkit.successMetrics.map((m) => `- ${m}`).join('\n')}\n\n`;
    }

    md += `### Interview Script\n`;
    idea.validationToolkit.interviewScript.forEach((q, i) => {
      md += `${i + 1}. ${q}\n`;
    });
    md += `\n`;
  } else {
    md += `## Validation Toolkit (Not Generated)\n*Generate the validation toolkit to see interview scripts and landing page copy.*\n\n`;
  }

  if (idea.trendSources && idea.trendSources.length > 0) {
    md += `## Market Sources\n`;
    md += idea.trendSources.map((s) => `- ${s}`).join('\n') + `\n\n`;
  }

  md += `---\n*Generated by Trend-Equity Intelligence Unit on ${new Date().toLocaleDateString()}*\n`;
  return md;
};

export const exportDocument = (idea: Idea, format: string) => {
  if (format === 'notion' || format === 'gdocs') {
    const md = generateNotionMarkdown(idea);
    navigator.clipboard
      .writeText(md)
      .then(() => {
        alert(
          `Content copied to clipboard! Paste it directly into ${format === 'notion' ? 'Notion' : 'Google Docs'}.`
        );
      })
      .catch(() => {
        alert('Failed to copy to clipboard. Please check permissions.');
      });
  } else {
    exportToPDF(idea, format);
  }
};

export const exportListToCSV = (ideas: Idea[], activeTab: string, today: string) => {
  if (ideas.length === 0) {
    alert('No ideas to export.');
    return;
  }

  const headers = ['Idea Name', 'Tags', 'Description'];
  const rows = ideas.map((idea) => [
    `"${idea.headline.replace(/"/g, '""')}"`,
    `"${(idea.categoryTags || []).join(', ').replace(/"/g, '""')}"`,
    `"${idea.pitch.replace(/"/g, '""')}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Trend_Equity_Ideas_${activeTab}_${today}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportListToPDF = (ideas: Idea[], activeTab: string, today: string) => {
  if (ideas.length === 0) {
    alert('No ideas to export.');
    return;
  }

  const doc = new jsPDF();
  const margin = 20;
  let y = 20;
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(`TREND EQUITY: ${activeTab.toUpperCase()} IDEAS`, margin, y);
  y += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated on ${new Date().toLocaleDateString()}`, margin, y);
  y += 15;

  ideas.forEach((idea, index) => {
    if (y > pageHeight - 40) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129);
    doc.text(`${index + 1}. ${idea.headline.toUpperCase()}`, margin, y);
    y += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100);
    doc.text(`TAGS: ${(idea.categoryTags || []).join(', ')}`, margin, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0);
    const pitchLines = doc.splitTextToSize(idea.pitch, 170);
    doc.text(pitchLines, margin, y);
    y += pitchLines.length * 5 + 10;
  });

  doc.save(`Trend_Equity_Ideas_${activeTab}_${today}.pdf`);
};
