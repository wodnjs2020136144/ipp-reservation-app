/**
 * screens/AiChatScreen.js
 * =====================================================
 * AI 예약 비서 챗봇 화면 (AX 피처)
 * 
 * 기능:
 * 1. 자연어로 예약 관련 질문을 입력하고 AI 답변 확인
 * 2. 빠른 제안 질문 카드 제공
 * 3. 깔끔하고 직관적인 메신저 형태의 UI/UX
 * =====================================================
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BASE_URL, fetchWithTimeout } from '../services/api';

// AI 챗봇은 Gemini 응답 생성(도구 호출 포함) 시간이 걸릴 수 있어 일반 API보다 넉넉하게 설정
const CHAT_TIMEOUT_MS = 30000;

const SUGGESTIONS = [
  "오늘 드론 VR 예약 남았어?",
  "인공지능 로봇 배움터 자리 있어?",
  "오늘 가능한 예약 요약해줘"
];

export default function AiChatScreen() {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      text: '안녕하세요! 충남과학교육원 AI 예약 비서입니다. 궁금하신 예약 일정을 자연스럽게 물어보세요! \n\n예: "오늘 지진 VR 자리가 남아있어?"',
      isAi: true,
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef();

  const handleSend = async (textToSend) => {
    const text = textToSend || input;
    if (!text.trim()) return;

    // 사용자 메시지 추가
    const userMsg = {
      id: Date.now().toString(),
      text: text,
      isAi: false,
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const response = await fetchWithTimeout(`${BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      }, CHAT_TIMEOUT_MS);

      const data = await response.json();

      const aiReply = {
        id: (Date.now() + 1).toString(),
        text: data.reply || '답변을 받아오지 못했습니다.',
        isAi: true,
        time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, aiReply]);
    } catch (err) {
      console.error('AI Chat Error:', err);
      const errorReply = {
        id: (Date.now() + 1).toString(),
        text: '서버와 연결할 수 없습니다. 백엔드 서버(Fly.io)가 작동 중인지 확인해 주세요.',
        isAi: true,
        isError: true,
        time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorReply]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 메시지가 추가될 때마다 최하단 스크롤
    if (flatListRef.current) {
      setTimeout(() => flatListRef.current.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, loading]);

  const renderItem = ({ item }) => (
    <View style={[styles.messageRow, item.isAi ? styles.aiRow : styles.userRow]}>
      {item.isAi && (
        <View style={[styles.avatar, item.isError && styles.errorAvatar]}>
          <Ionicons name={item.isError ? "alert-circle" : "sparkles"} size={16} color="#fff" />
        </View>
      )}
      <View style={[
        styles.bubble, 
        item.isAi ? styles.aiBubble : styles.userBubble,
        item.isError && styles.errorBubble
      ]}>
        <Text style={[styles.messageText, item.isAi ? styles.aiText : styles.userText]}>
          {item.text}
        </Text>
        <Text style={styles.timeText}>{item.time}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Ionicons name="sparkles-sharp" size={20} color="#007AFF" />
        <Text style={styles.headerTitle}>AI 예약 비서 (AX)</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* 대화 목록 */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={() => loading && (
            <View style={styles.loadingRow}>
              <View style={styles.avatar}>
                <Ionicons name="sparkles" size={16} color="#fff" />
              </View>
              <View style={[styles.bubble, styles.aiBubble, styles.loadingBubble]}>
                <ActivityIndicator size="small" color="#007AFF" />
              </View>
            </View>
          )}
        />

        {/* 제안어 추천 카드 */}
        {messages.length === 1 && !loading && (
          <View style={styles.suggestionsContainer}>
            {SUGGESTIONS.map((s, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.suggestionCard}
                onPress={() => handleSend(s)}
              >
                <Text style={styles.suggestionText}>{s}</Text>
                <Ionicons name="arrow-forward-outline" size={14} color="#007AFF" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* 입력란 */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="예약 문의 내용을 입력해보세요..."
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => handleSend()}
            editable={!loading}
          />
          <TouchableOpacity 
            style={[styles.sendButton, !input.trim() && styles.disabledSendButton]}
            onPress={() => handleSend()}
            disabled={!input.trim() || loading}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    height: 56,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#E1E5EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  keyboardContainer: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 8,
    maxWidth: '85%',
  },
  aiRow: {
    alignSelf: 'flex-start',
    gap: 8,
  },
  userRow: {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
  errorAvatar: {
    backgroundColor: '#FF3B30',
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  aiBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  errorBubble: {
    backgroundColor: '#FFE5E5',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  aiText: {
    color: '#334155',
  },
  userText: {
    color: '#fff',
  },
  timeText: {
    fontSize: 9,
    color: '#94A3B8',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  loadingRow: {
    flexDirection: 'row',
    marginVertical: 8,
    gap: 8,
  },
  loadingBubble: {
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomLeftRadius: 4,
  },
  suggestionsContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'between',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'space-between'
  },
  suggestionText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    gap: 8,
  },
  textInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#1E293B',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledSendButton: {
    backgroundColor: '#CBD5E1',
  },
});
