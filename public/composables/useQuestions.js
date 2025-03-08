// composables/useQuestions.js
import { useRealTime } from './useRealTime.js';

const questions = Vue.ref([]);
const answers = Vue.ref([]);
const { userUuid, emit, on, off } = useRealTime();
const eventHandlers = new WeakMap();
const processedEvents = new Set();

export function useQuestions() {

  const handleAddQuestion = (eventObj) => {
    const { id, userUuid: eventUserUuid, data, timestamp } = eventObj;
    const eventKey = `add-question-${id}-${timestamp}`;
    if (!processedEvents.has(eventKey)) {
      processedEvents.add(eventKey);
      if (!questions.value.some(q => q.id === id)) {
        questions.value.push({ id, userUuid: eventUserUuid, data });
        questions.value = [...questions.value];
      }
      setTimeout(() => processedEvents.delete(eventKey), 1000);
    }
  };

  const handleUpdateQuestion = (eventObj) => {
    const { id, userUuid: eventUserUuid, data, timestamp } = eventObj;
    const question = questions.value.find(q => q.id === id);
    if (question) {
      question.data.text = data.text;
      questions.value = [...questions.value];
    }
  };

  const handleDeleteQuestion = (eventObj) => {
    const { id, timestamp } = eventObj;
    questions.value = questions.value.filter(q => q.id !== id);
    answers.value = answers.value.filter(a => a.data.questionId !== id); // Clean up answers
    questions.value = [...questions.value];
  };

  const handleReorderQuestions = (eventObj) => {
    const { id, userUuid: eventUserUuid, data, timestamp } = eventObj;
    questions.value = data.order.map((qId, index) => {
      const question = questions.value.find(q => q.id === qId);
      return { ...question, data: { ...question.data, order: index } };
    });
    questions.value = [...questions.value];
  };

  const handleAddAnswer = (eventObj) => {
    const { id, userUuid: eventUserUuid, data, timestamp } = eventObj;
    const eventKey = `add-answer-${id}-${timestamp}`;
    if (!processedEvents.has(eventKey)) {
      processedEvents.add(eventKey);
      if (!answers.value.some(a => a.id === id)) {
        answers.value.push({ id, userUuid: eventUserUuid, data });
        answers.value = [...answers.value];
      }
      setTimeout(() => processedEvents.delete(eventKey), 1000);
    }
  };

  const handleUpdateAnswer = (eventObj) => {
    const { id, userUuid: eventUserUuid, data, timestamp } = eventObj;
    const answer = answers.value.find(a => a.id === id);
    if (answer) {
      answer.data.text = data.text;
      answers.value = [...answers.value];
    }
  };

  const handleDeleteAnswer = (eventObj) => {
    const { id, timestamp } = eventObj;
    answers.value = answers.value.filter(a => a.id !== id);
    answers.value = [...answers.value];
  };

  const handleVoteAnswer = (eventObj) => {
    const { id, userUuid: eventUserUuid, data, timestamp } = eventObj;
    const answer = answers.value.find(a => a.id === id);
    if (answer) {
      if (data.votes !== undefined) {
        answer.data.votes = data.votes;
      } else if (data.vote) {
        answer.data.votes = (answer.data.votes || 0) + (data.vote === 'up' ? 1 : -1);
      }
      answers.value = [...answers.value];
    }
  };

  on('add-question', handleAddQuestion);
  on('update-question', handleUpdateQuestion);
  on('remove-question', handleDeleteQuestion);
  on('reorder-questions', handleReorderQuestions);
  on('add-answer', handleAddAnswer);
  on('update-answer', handleUpdateAnswer);
  on('delete-answer', handleDeleteAnswer);
  on('vote-answer', handleVoteAnswer);

  const questionsWithAnswers = Vue.computed(() => {
    return questions.value.map(question => ({
      id: question.id,
      userUuid: question.userUuid,
      data: {
        ...question.data,
        answers: answers.value
          .filter(a => a.data.questionId === question.id)
          .sort((a, b) => (b.data.votes || 0) - (a.data.votes || 0)),
      },
    })).sort((a, b) => a.data.order - b.data.order);
  });

  const addQuestion = (text) => {
    const id = uuidv4();
    const data = { text, order: questions.value.length };
    const payload = { id, userUuid: userUuid.value, data, timestamp: Date.now() };
    questions.value.push(payload);
    questions.value = [...questions.value];
    emit('add-question', payload);
  };

  const updateQuestion = (id, text) => {
    const question = questions.value.find(q => q.id === id);
    if (question) {
      question.data.text = text;
      questions.value = [...questions.value];
      emit('update-question', { id, userUuid: userUuid.value, data: { text }, timestamp: Date.now() });
    }
  };

  const deleteQuestion = (id) => {
    questions.value = questions.value.filter(q => q.id !== id);
    answers.value = answers.value.filter(a => a.data.questionId !== id);
    questions.value = [...questions.value];
    emit('remove-question', { id, userUuid: userUuid.value, data: null, timestamp: Date.now() });
  };

  const reorderQuestions = (draggedId, newIndex) => {
    const currentIndex = questions.value.findIndex(q => q.id === draggedId);
    const newOrder = [...questions.value];
    const [moved] = newOrder.splice(currentIndex, 1);
    newOrder.splice(newIndex, 0, moved);
    newOrder.forEach((q, i) => q.data.order = i);
    questions.value = newOrder;
    questions.value = [...questions.value];
    emit('reorder-questions', { id: uuidv4(), userUuid: userUuid.value, data: { order: newOrder.map(q => q.id) }, timestamp: Date.now() });
  };

  const addAnswer = (questionId) => {
    const id = uuidv4();
    const data = { questionId, text: '', votes: 0 };
    const payload = { id, userUuid: userUuid.value, data, timestamp: Date.now() };
    answers.value.push(payload);
    answers.value = [...answers.value];
    emit('add-answer', payload);
    return id;
  };

  const updateAnswer = (id, questionId, text) => {
    const answer = answers.value.find(a => a.id === id);
    if (answer) {
      answer.data.text = text;
      answers.value = [...answers.value];
      emit('update-answer', { id, userUuid: userUuid.value, data: { questionId, text }, timestamp: Date.now() });
    }
  };

  const deleteAnswer = (id, questionId) => {
    answers.value = answers.value.filter(a => a.id !== id);
    answers.value = [...answers.value];
    emit('delete-answer', { id, userUuid: userUuid.value, data: { questionId }, timestamp: Date.now() });
  };

  const voteAnswer = (questionId, id, vote) => {
    const answer = answers.value.find(a => a.id === id);
    if (answer) {
      answer.data.votes = (answer.data.votes || 0) + (vote === 'up' ? 1 : -1);
      answers.value = [...answers.value];
      emit('vote-answer', { 
        id, 
        userUuid: userUuid.value, 
        data: { questionId, vote, votes: answer.data.votes }, 
        timestamp: Date.now() 
      });
    }
  };
  
  const addQuestionProgrammatically = (text) => {
    addQuestion(text);
  };

  const cleanup = () => {
    off('add-question', handleAddQuestion);
    off('update-question', handleUpdateQuestion);
    off('remove-question', handleDeleteQuestion);
    off('reorder-questions', handleReorderQuestions);
    off('add-answer', handleAddAnswer);
    off('update-answer', handleUpdateAnswer);
    off('delete-answer', handleDeleteAnswer);
    off('vote-answer', handleVoteAnswer);
    processedEvents.clear();
  };

  return {
    questions,
    answers,
    questionsWithAnswers,
    rawQuestions: questions,
    rawAnswers: answers,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    reorderQuestions,
    addAnswer,
    updateAnswer,
    deleteAnswer,
    voteAnswer,
    addQuestionProgrammatically,
    cleanup,
  };
}