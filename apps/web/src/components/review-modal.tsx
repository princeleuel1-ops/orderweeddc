'use client';

import { useState } from 'react';

type Props = {
  retailerName: string;
};

export default function ReviewModal({ retailerName }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setIsOpen(false);
      setComment('');
    }, 2000);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="w-full text-center block text-[10px] font-bold text-black bg-brand-background border border-brand-border hover:border-black py-2 rounded transition-all cursor-pointer"
      >
        ⭐ Submit Patient Rating & Review
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs animate-fade-in p-4">
          <div className="w-full max-w-md bg-brand-surface border border-brand-border rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-brand-border pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Patient Review
                </span>
                <h3 className="text-base font-extrabold text-brand-text mt-0.5">{retailerName}</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-brand-text font-bold text-lg p-1"
              >
                ✕
              </button>
            </div>

            {submitted ? (
              <div className="text-center py-8 space-y-2">
                <span className="text-2xl">✅</span>
                <p className="text-sm font-bold text-brand-text">Thank you for your rating!</p>
                <p className="text-xs text-slate-500">
                  Your feedback helps maintain accurate primary-source evidence for D.C. patients.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Overall Rating</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setRating(star)}
                        className={`text-lg transition-transform hover:scale-110 ${
                          star <= rating ? 'opacity-100' : 'opacity-30'
                        }`}
                      >
                        ⭐
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="review-comments" className="block text-xs font-bold text-slate-600 mb-1">
                    Your Patient Experience & Feedback
                  </label>
                  <textarea
                    id="review-comments"
                    rows={3}
                    required
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Share feedback on product quality, service speed, and menu accuracy..."
                    className="w-full bg-brand-background border border-brand-border rounded p-3 text-xs text-brand-text focus:border-black focus:outline-none"
                  />
                </div>

                <p className="text-[10px] text-slate-500">
                  Patient ratings are subject to primary-source verification and moderation audit rules.
                </p>

                <div className="flex justify-end gap-2 pt-2 border-t border-brand-border">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="text-xs font-bold px-4 py-2 text-slate-500 hover:text-brand-text"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-black text-white text-xs font-bold px-4 py-2 rounded hover:bg-slate-800 transition-colors"
                  >
                    Submit Rating →
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
