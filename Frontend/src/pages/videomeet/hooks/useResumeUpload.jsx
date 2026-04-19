import { useState } from "react";
import axios from "axios";

export default function useResumeUpload() {
  const [resumeId, setResumeId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const uploadResume = async (file) => {
    const formData = new FormData();
    formData.append("resume", file); // "resume" matches multer field name

    try {
      setLoading(true);
      setError(null);
      const res = await axios.post("/api/resume", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setResumeId(res.data.resumeId);
      setUploadMessage(res.data.message);
    } catch (e) {
      setErrorMessage("Upload failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchGeneralizedQuestions = async () => {
    if (!resumeId) {
      return;
    }
    try {
      const res = axios.get(`/api/resume/${resumeId}/question`);
      setQuestions(res.data.questions);
    } catch (e) {
      setError("Failed to fetch generalized questions.");
    }
  };

  const fetchSkillQuestions = async () => {
    if (!resumeId) {
      return;
    }
    try {
      const res = axios.get(`/api/resume/${resumeId}/question/skill`);
      setQuestions(res.data.questions);
    } catch (e) {
      setError("Failed to fetch skill questions.");
    }
  };

  const regenerateQuestions = async () => {
    if (!resumeId) return;
    try {
      const res = await axios.get(`/api/resume/${resumeId}/question/new`);
      setQuestions(res.data.questions);
    } catch (err) {
      setError("Failed to regenerate questions.");
    }
  };

  return {
    resumeId,
    questions,
    loading,
    uploadMessage,
    errorMessage,
    uploadResume,
    fetchGeneralizedQuestions,
    fetchSkillQuestions,
    regenerateQuestions,
  };
}
