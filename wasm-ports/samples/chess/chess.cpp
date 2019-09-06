
#include <fstream>
#include <sstream>
#include <iostream>
#include <ctype.h>
#include <map>

using namespace std;

void result(int num, const char *string) {
  std::ofstream t("output.data");
  t << "At move " << num << " " << string << endl;
  t.close();
  exit(0);
}

void move(string &state, int x1, int y1, int x2, int y2) {
  char tmp = state[x1+y1*8];
  state[x1+y1*8] = ' ';
  state[x2+y2*8] = tmp;
}

bool validDir(string &state, int x1, int y1, int x2, int y2, int dirx, int diry) {
   int x = x2; int y = y2;
   while (true) {
     x += dirx;
     y += diry;
     if (x == x1 && y == y1) return true;
     char piece = state[x1+y1*8];
     if (piece != ' ') return false;
   }
   return true;
}

bool validBishop(string &state, int x1, int y1, int x2, int y2) {
   int dx = x1-x2;
   int dy = y1-y2;
   if (dx*dx != dy*dy) return false;
   int dirx = dx>0 ? 1 : -1;
   int diry = dy>0 ? 1 : -1;
   return validDir(state, x1, y1, x2, y2, dirx, diry);
}

bool validRook(string &state, int x1, int y1, int x2, int y2) {
   int dx = x1-x2;
   int dy = y1-y2;
   if (dx == 0) {
     int diry = dy>0 ? 1 : -1;
     return validDir(state, x1, y1, x2, y2, 0, diry);
   }
   else if (dy == 0) {
     int dirx = dx>0 ? 1 : -1;
     return validDir(state, x1, y1, x2, y2, dirx, 0);
   }
   else return false;
}

bool validKnight(string &state, int x1, int y1, int x2, int y2) {
   int dx = x1-x2;
   int dy = y1-y2;
   return (dx*dx + dy*dy == 5);
}

bool validQueen(string &state, int x1, int y1, int x2, int y2) {
  return validRook(state, x1, y1, x2, y2) || validKnight(state, x1, y1, x2, y2);
}

bool validKing(string &state, int x1, int y1, int x2, int y2) {
   int dx = x1-x2;
   int dy = y1-y2;
   return dx*dx + dy*dy < 3;
}

bool checkPieceMove(string &state, int x1, int y1, int x2, int y2, char piece) {
  // first check that we have a white piece
  if (piece == 'h') return validKnight(state, x1, y1, x2, y2);
  else if (piece == 'r') return validRook(state, x1, y1, x2, y2);
  else if (piece == 'b') return validBishop(state, x1, y1, x2, y2);
  else if (piece == 'q') return validQueen(state, x1, y1, x2, y2);
  else if (piece == 'k') return validBishop(state, x1, y1, x2, y2);
  return false;
}

bool checkWhiteMove(string &state, int x1, int y1, int x2, int y2) {
  // first check that we have a white piece
  char piece = state[x1+y1*8];
  if (piece < 'A' || piece > 'Z') {
    // cout << "No white piece" << endl;
    return false;
  }
  char other = state[x2+y2*8];
  if (other > 'A' && other < 'Z') {
    // cout << "White cannot eat white" << endl;
    return false;
  }
  if (piece == 'S') {
     if (other == ' ') {
        if (x1 != x2) return false;
        if (y1 == 6 && y2 != 5 && y2 != 4) return false;
        if (y1 < 6 && y2+1 != y1) return false;
     }
     else {
        if (x1 != x2+1 && x1+1 != x2) return false;
        if (y1 != y2+1) return false;
     }
  }
  else if (!checkPieceMove(state, x1, y1, x2, y2, tolower(piece))) {
     // cout << "invalid move for piece " << piece << endl;
     return false;
  }
  return true;
}

bool checkBlackMove(string &state, int x1, int y1, int x2, int y2) {
  // first check that we have a white piece
  char piece = state[x1+y1*8];
  if (piece < 'a' || piece > 'z') {
    // cout << "No black piece" << endl;
    return false;
  }
  char other = state[x2+y2*8];
  if (other > 'a' && other < 'z') {
    // cout << "Black cannot eat black" << endl;
    return false;
  }
  if (piece == 's') {
     if (other == ' ') {
        if (x1 != x2) return false;
        if (y1 == 1 && y2 != 2 && y2 != 3) return false;
        if (y1 > 1 && y2 != y1+1) return false;
     }
     else {
        if (x1 != x2+1 && x1+1 != x2) return false;
        if (y1+1 != y2) return false;
     }
  }
  else if (!checkPieceMove(state, x1, y1, x2, y2, tolower(piece))) {
     // cout << "Invalid move for piece " << piece << endl;
     return false;
  }
  return true;
}

bool canMoveTo(string &state, int x1, int y1, bool white) {
    for (int x = 0; x < 8; x++) {
      for (int y = 0; y < 8; y++) {
        if (white && checkWhiteMove(state, x, y, x1, y1)) return true;
        if (!white && checkBlackMove(state, x, y, x1, y1)) return true;
      }
    }
    return false;
}

bool hasChess(string &state, bool white) {
    for (int x = 0; x < 8; x++) {
      for (int y = 0; y < 8; y++) {
        char piece = state[x+y*8];
        if (piece == 'K' && white) {
          return canMoveTo(state, x, y, !white);
        }
        if (piece == 'k' && !white) {
          return canMoveTo(state, x, y, !white);
        }
      }
    }
    return false;
}

bool performWhiteMove(string &state, int x1, int y1, int x2, int y2) {
      if (!checkWhiteMove(state, x1, y1, x2, y2)) return false;
      move(state, x1, y1, x2, y2);
      if (hasChess(state, true)) return false; // White king in chess
      return true;
}

bool performBlackMove(string &state, int x1, int y1, int x2, int y2) {
      if (!checkBlackMove(state, x1, y1, x2, y2)) return false;
      move(state, x1, y1, x2, y2);
      if (hasChess(state, false)) return false; // Black king in chess
      return true;
}

bool isStuck(string &state, bool white) {
  for (int x1 = 0; x1 < 8; x1++) {
    for (int y1 = 0; y1 < 8; y1++) {
      for (int x2 = 0; x2 < 8; x2++) {
        for (int y2 = 0; y2 < 8; y2++) {
          string state2(state);
          if (white) {
            if (performWhiteMove(state2, x1, y1, x2, y2)) return false;
          }
          if (!white) {
            if (performBlackMove(state2, x1, y1, x2, y2)) return false;
          }
        }
      }
    }
  }
  return true;
}

bool checkMate(string &state, bool white) {
  if (!hasChess(state, white)) return false;
  else return isStuck(state, white);
}

bool staleMate(string &state, bool white) {
  if (hasChess(state, white)) return false;
  else return isStuck(state, white);
}

int main(int argc, char **argv) {
  std::ifstream t("input.data");
  std::stringstream buffer;
  buffer << t.rdbuf();

  cout << "Locations on board: " << endl;
  for (int i = 0; i < 8; i++) {
    for (int j = 0; j < 8; j++) {
      char chr = (char)(i*8 + j + 64);
      if (chr >= 127) chr -= 64;
      cout << chr;
    }
    cout << endl;
  }

  cout << "Reading moves, each move has the start and end position of the moved piece " << buffer.str() << endl;
  string state("rhbqkbhrssssssss                                SSSSSSSSRHBQKBHR");
  cout << state << ":" << state.length() << endl;

  string moves = buffer.str();
  bool white = true;
  map<string, int> prev_states;
  prev_states[state] = 1;
  for (int i = 0; i < moves.length()-1; i += 2) {
    int m1 = (int)moves[i];
    int m2 = (int)moves[i+1];
    int x1 = m1 % 8; int y1 = (m1/8) % 8;
    int x2 = m2 % 8; int y2 = (m2/8) % 8;
    if (x1 == x2 && y1 == y2) {
      cout << "Empty move" << endl;
      if (white) result(i/2, "Empty move from white");
      else result(i/2, "Empty move from black");
    }
    else if (white) {
      if (!performWhiteMove(state, x1, y1, x2, y2)) {
        result(i/2, "White move illegal");
      }
      if (checkMate(state, false)) {
        result(i/2, "Black at chessmate, white wins");
      }
    }
    else {
      if (!performBlackMove(state, x1, y1, x2, y2)) {
        result(i/2, "Black move illegal");
      }
      if (checkMate(state, true)) {
        result(i/2, "White at chessmate, white wins");
      }
    }
    if (prev_states.find(state) == prev_states.end()) {
      prev_states[state] = 1;
    }
    else {
      prev_states[state] = prev_states[state] + 1;
    }

    if (prev_states[state] >= 3) {
      cout << "A " << prev_states[state] << endl;
      result(i/2, "Stalemate, repeated piece configuration");
    }
    cout << state << ":" <<  prev_states[state] << endl;
    white = !white;

    if (staleMate(state, white)) {
      result(i/2, "Stalemate, no moves");
    }
  }
  result(moves.length()/2, "No more moves");
  return 0;
}

