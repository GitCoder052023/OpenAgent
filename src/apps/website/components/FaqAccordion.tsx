"use client";

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { FAQS } from "@/lib/faqsData";

export function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <div className="w-full divide-y divide-[#ebe8e4] border-y border-[#ebe8e4]">
      {FAQS.map((faq, idx) => {
        const isOpen = openIndex === idx;
        return (
          <div key={idx} className="py-5 transition-colors">
            <button
              type="button"
              onClick={() => toggle(idx)}
              className="w-full flex items-center justify-between text-left gap-4 focus:outline-none group"
              aria-expanded={isOpen}
            >
              <span className="text-[16px] md:text-[18px] font-normal text-black group-hover:text-[#44403b] transition-colors">
                {faq.question}
              </span>
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-[#f5f3f1] border border-[#ebe8e4] text-[#44403b] transition-transform duration-200 ${
                  isOpen ? "rotate-180" : ""
                }`}
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </div>
            </button>
            {isOpen && (
              <div className="mt-3.5 pr-8 text-[15px] leading-relaxed text-[#777169]">
                {faq.answer}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
