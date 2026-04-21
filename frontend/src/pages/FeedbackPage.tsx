import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle, XCircle, Star, Loader } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '/api';

export default function FeedbackPage() {
  const { token } = useParams<{ token: string }>();

  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<{ ticketId: string; subject: string; status: string } | null>(null);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyClosed, setAlreadyClosed] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await axios.get(`${API}/support/public-feedback/${token}`);
        if (data.data?.status === 'Closed') { setAlreadyClosed(true); setLoading(false); return; }
        setTicket(data.data);
      } catch {
        setError('This feedback link is invalid or has already been used.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return;
    setSubmitting(true);
    try {
      const ratingText = rating ? ` [Rating: ${rating}/5]` : '';
      await axios.post(`${API}/support/public-feedback/${token}`, {
        feedback: feedback.trim() + ratingText,
      });
      setSubmitted(true);
    } catch {
      setError('Failed to submit feedback. The link may have already been used.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader className="animate-spin text-violet-600" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="h-1.5 bg-gradient-to-r from-violet-600 to-blue-500" />
        <div className="p-8">

          {/* Already closed */}
          {alreadyClosed && (
            <div className="text-center">
              <CheckCircle className="mx-auto text-green-500 mb-4" size={56} />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Feedback Already Submitted</h1>
              <p className="text-gray-500">This ticket has been closed. Thank you for your response!</p>
            </div>
          )}

          {/* Error */}
          {!alreadyClosed && error && (
            <div className="text-center">
              <XCircle className="mx-auto text-red-400 mb-4" size={56} />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Link Unavailable</h1>
              <p className="text-gray-500">{error}</p>
            </div>
          )}

          {/* Success */}
          {submitted && (
            <div className="text-center">
              <CheckCircle className="mx-auto text-green-500 mb-4" size={56} />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h1>
              <p className="text-gray-500 mb-1">Your feedback has been submitted and your ticket is now closed.</p>
              <p className="text-sm text-gray-400">We appreciate you taking the time to let us know.</p>
            </div>
          )}

          {/* Form */}
          {!alreadyClosed && !error && !submitted && ticket && (
            <>
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-1">How did we do?</h1>
                <p className="text-sm text-gray-500">Ticket <span className="font-mono font-semibold text-violet-600">{ticket.ticketId}</span></p>
                <p className="text-sm text-gray-500 mt-0.5 truncate">{ticket.subject}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Star rating */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 text-center">Rate your experience</label>
                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHovered(star)}
                        onMouseLeave={() => setHovered(0)}
                        className="transition-transform hover:scale-110 focus:outline-none"
                      >
                        <Star
                          size={36}
                          className={`transition-colors ${(hovered || rating) >= star ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                        />
                      </button>
                    ))}
                  </div>
                  {rating > 0 && (
                    <p className="text-center text-sm text-gray-500 mt-1">
                      {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating]}
                    </p>
                  )}
                </div>

                {/* Feedback text */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Your feedback <span className="text-red-500">*</span></label>
                  <textarea
                    required
                    rows={5}
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Please share your experience. Was the issue resolved to your satisfaction? Any suggestions for improvement?"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || !feedback.trim()}
                  className="w-full py-3 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {submitting ? <><Loader size={16} className="animate-spin" /> Submitting…</> : 'Submit Feedback'}
                </button>
              </form>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
