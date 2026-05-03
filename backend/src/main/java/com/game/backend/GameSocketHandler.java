package com.game.backend;

import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicBoolean;


import java.io.IOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

public class GameSocketHandler extends TextWebSocketHandler {
    private static final List<WebSocketSession> sessions = new CopyOnWriteArrayList<>();
    private static final AtomicInteger playerCount = new AtomicInteger(0);

    private static final AtomicInteger redScore = new AtomicInteger(0);
    private static final AtomicInteger blueScore = new AtomicInteger(0);

    private static final AtomicBoolean redReady = new AtomicBoolean(false);
    private static final AtomicBoolean blueReady = new AtomicBoolean(false);

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        sessions.add(session);
        int count = playerCount.incrementAndGet();

        String color = (count % 2 == 1) ? "0xff0000" : "0x00aaff";
        String assignMsg = String.format("{\"type\":\"assign\", \"id\":\"%s\", \"color\":\"%s\"}", getShortId(session), color);
        session.sendMessage(new TextMessage(assignMsg));

        sendScoreUpdate();

        System.out.println("Player connected: " + getShortId(session) + " assigned color: " + color);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();

        if (payload.contains("\"type\":\"collect\"")) {
            // Update the official score
            if (payload.contains("\"color\":\"red\"")) {
                redScore.addAndGet(1);
            } else if (payload.contains("\"color\":\"blue\"")) {
                blueScore.addAndGet(1);
            }
            sendScoreUpdate();

            for (WebSocketSession s : sessions) { // for everyone to hide the gem
                if (s.isOpen() && !s.getId().equals(session.getId())) {
                    s.sendMessage(new TextMessage(payload));
                }
            }
        } else if (payload.contains("\"type\":\"door_status\"")) {
            // Update the checklist safely across threads
            if (payload.contains("\"color\":\"red\"")) {
                redReady.set(payload.contains("\"ready\":true"));
            } else if (payload.contains("\"color\":\"blue\"")) {
                blueReady.set(payload.contains("\"ready\":true"));
            }

            // Check if BOTH players are at their doors!
            if (redReady.get() && blueReady.get()) {
                String winMsg = "{\"type\":\"win\"}";
                for (WebSocketSession s : sessions) {
                    if (s.isOpen()) s.sendMessage(new TextMessage(winMsg));
                }

                redReady.set(false);
                blueReady.set(false);
            }
        } else if (payload.contains("\"type\":\"request_next_level\"")) {
            // 1. Reset the Server Data
            redScore.set(0);
            blueScore.set(0);
            redReady.set(false);
            blueReady.set(false);
            sendScoreUpdate(); // Broadcast 0-0 to everyone

            // 2. Tell both clients to load Level 2!
            for (WebSocketSession s : sessions) {
                if (s.isOpen()) s.sendMessage(new TextMessage("{\"type\":\"start_next_level\"}"));
            }

       } else if (payload.contains("\"type\":\"request_retry\"")) {
            // 1. Reset the Server Data
            redScore.set(0);
            blueScore.set(0);
            redReady.set(false);
            blueReady.set(false);
            sendScoreUpdate(); // Broadcast 0-0 to everyone

            // 2. Tell both clients to restart the current level!
            for (WebSocketSession s : sessions) {
                if (s.isOpen()) s.sendMessage(new TextMessage("{\"type\":\"start_retry\"}"));
            } // <-- CLOSED THE FOR LOOP
        } // <-- CLOSED THE ELSE IF BLOCK

        else if (payload.contains("\"type\":\"game_over\"")) {
            // If anyone dies, tell EVERYONE the game is over!
            String deadMsg = "{\"type\":\"game_over\"}";
            for (WebSocketSession s : sessions) {
                if (s.isOpen()) s.sendMessage(new TextMessage(deadMsg));
            }
        } else {
            // It's a Movement message! Forward it to everyone else.
            String jsonMessage = String.format("{\"type\":\"move\", \"id\":\"%s\", \"position\":%s}", getShortId(session), payload);
            for (WebSocketSession s : sessions) {
                if (s.isOpen() && !s.getId().equals(session.getId())) {
                    s.sendMessage(new TextMessage(jsonMessage));
                }
            }
        }
    } // <-- End of handleTextMessage

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        sessions.remove(session);
        System.out.println("Player disconnected: " + getShortId(session));
        redReady.set(false);
        blueReady.set(false);
    }

    private void sendScoreUpdate() throws IOException {
        String scoreMsg = String.format("{\"type\":\"score\", \"red\":%d, \"blue\":%d}", redScore.get(), blueScore.get());
        for (WebSocketSession s : sessions) {
            if (s.isOpen()) {
                s.sendMessage(new TextMessage(scoreMsg));
            }
        }
    }

    private String getShortId(WebSocketSession session) {
        return session.getId().substring(0,4);
    }
}