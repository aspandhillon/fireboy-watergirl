package com.game.backend;

import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import java.util.concurrent.atomic.AtomicInteger;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

public class GameSocketHandler extends TextWebSocketHandler {
    private static final List<WebSocketSession> sessions = new CopyOnWriteArrayList<>();
    
    private static final AtomicInteger playerCount = new AtomicInteger(0);
    
    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        sessions.add(session);
        int count = playerCount.incrementAndGet();

        String color = (count % 2 == 1) ? "0xff0000" : "0x00aaff";
        String assignMsg = String.format("{\"type\":\"assign\", \"id\":\"%s\", \"color\":\"%s\"}", getShortId(session), color);
        session.sendMessage(new TextMessage(assignMsg));

        System.out.println("Player connected: " + getShortId(session) + " assigned color: " + color);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        // Player's xy co-ordinated
        String payload = message.getPayload();
        String jsonMessage = String.format("{\"type\":\"move\", \"id\":\"%s\", \"position\":%s}", getShortId(session), payload);        for (WebSocketSession s : sessions) {
            // Broadcast to everyone EXCEPT the person who just moved
            if (s.isOpen() && !s.getId().equals(session.getId())) {
                s.sendMessage(new TextMessage(jsonMessage));
            }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        sessions.remove(session);
        System.out.println("Player disconnected: " + getShortId(session));
    }

    private void broadcast(String message) throws IOException {
        for (WebSocketSession s : sessions) {
            if (s.isOpen()) {
                s.sendMessage(new TextMessage(message));
            }
        }
    }

    private String getShortId(WebSocketSession session) {
        return session.getId().substring(0,4);
    }
}