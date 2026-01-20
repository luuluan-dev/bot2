/**
 * Chess Engine - Xử lý logic cờ vua
 * Hỗ trợ FEN notation, di chuyển quân cờ, kiểm tra nước đi hợp lệ
 */

// Các ký tự Unicode cho quân cờ
export const PIECES = {
    white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
    black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' }
};

// Map ký tự FEN sang tên quân cờ
const FEN_TO_PIECE: { [key: string]: string } = {
    'K': 'white_king', 'Q': 'white_queen', 'R': 'white_rook',
    'B': 'white_bishop', 'N': 'white_knight', 'P': 'white_pawn',
    'k': 'black_king', 'q': 'black_queen', 'r': 'black_rook',
    'b': 'black_bishop', 'n': 'black_knight', 'p': 'black_pawn'
};

const PIECE_TO_FEN: { [key: string]: string } = {
    'white_king': 'K', 'white_queen': 'Q', 'white_rook': 'R',
    'white_bishop': 'B', 'white_knight': 'N', 'white_pawn': 'P',
    'black_king': 'k', 'black_queen': 'q', 'black_rook': 'r',
    'black_bishop': 'b', 'black_knight': 'n', 'black_pawn': 'p'
};

export type Square = string | null;
export type Board = Square[][];

export interface Position {
    row: number;
    col: number;
}

export interface MoveResult {
    success: boolean;
    board?: Board;
    fen?: string;
    message?: string;
    isCheck?: boolean;
    isCheckmate?: boolean;
    isStalemate?: boolean;
    capturedPiece?: string;
    promotion?: boolean;
}

/**
 * Parse FEN string thành board 2D array
 */
export function fenToBoard(fen: string): Board {
    const board: Board = [];
    const fenParts = fen.split(' ');
    const rows = fenParts[0].split('/');

    for (const row of rows) {
        const boardRow: Square[] = [];
        for (const char of row) {
            if (/[1-8]/.test(char)) {
                // Ô trống
                for (let i = 0; i < parseInt(char); i++) {
                    boardRow.push(null);
                }
            } else {
                boardRow.push(FEN_TO_PIECE[char] || null);
            }
        }
        board.push(boardRow);
    }

    return board;
}

/**
 * Convert board 2D array thành FEN string
 */
export function boardToFen(board: Board, currentTurn: string): string {
    let fen = '';
    
    for (let row = 0; row < 8; row++) {
        let emptyCount = 0;
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (piece === null) {
                emptyCount++;
            } else {
                if (emptyCount > 0) {
                    fen += emptyCount;
                    emptyCount = 0;
                }
                fen += PIECE_TO_FEN[piece] || '?';
            }
        }
        if (emptyCount > 0) {
            fen += emptyCount;
        }
        if (row < 7) fen += '/';
    }

    // Thêm phần còn lại của FEN (đơn giản hóa)
    fen += ` ${currentTurn === 'white' ? 'w' : 'b'} KQkq - 0 1`;
    
    return fen;
}

/**
 * Chuyển đổi notation (vd: e2) thành vị trí [row, col]
 */
export function notationToPosition(notation: string): Position | null {
    if (notation.length !== 2) return null;
    
    const col = notation.charCodeAt(0) - 'a'.charCodeAt(0);
    const row = 8 - parseInt(notation[1]);
    
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    
    return { row, col };
}

/**
 * Chuyển đổi vị trí [row, col] thành notation
 */
export function positionToNotation(pos: Position): string {
    const col = String.fromCharCode('a'.charCodeAt(0) + pos.col);
    const row = 8 - pos.row;
    return `${col}${row}`;
}

/**
 * Kiểm tra xem quân cờ có thuộc bên nào
 */
export function getPieceColor(piece: string | null): string | null {
    if (!piece) return null;
    return piece.startsWith('white') ? 'white' : 'black';
}

/**
 * Lấy loại quân cờ
 */
export function getPieceType(piece: string | null): string | null {
    if (!piece) return null;
    return piece.split('_')[1];
}

/**
 * Kiểm tra nước đi cơ bản có hợp lệ không
 */
export function isValidMove(board: Board, from: Position, to: Position, currentTurn: string): MoveResult {
    const piece = board[from.row][from.col];
    
    // Kiểm tra có quân cờ không
    if (!piece) {
        return { success: false, message: '❌ Không có quân cờ ở vị trí này!' };
    }
    
    // Kiểm tra có phải lượt của mình không
    const pieceColor = getPieceColor(piece);
    if (pieceColor !== currentTurn) {
        return { success: false, message: `❌ Không phải lượt của bạn! Lượt hiện tại: **${currentTurn === 'white' ? 'Trắng ⚪' : 'Đen ⚫'}**` };
    }
    
    // Kiểm tra không ăn quân mình
    const targetPiece = board[to.row][to.col];
    if (targetPiece && getPieceColor(targetPiece) === currentTurn) {
        return { success: false, message: '❌ Không thể ăn quân của mình!' };
    }
    
    // Kiểm tra nước đi theo từng loại quân
    const pieceType = getPieceType(piece);
    let validMove = false;
    
    switch (pieceType) {
        case 'pawn':
            validMove = isValidPawnMove(board, from, to, currentTurn);
            break;
        case 'rook':
            validMove = isValidRookMove(board, from, to);
            break;
        case 'knight':
            validMove = isValidKnightMove(from, to);
            break;
        case 'bishop':
            validMove = isValidBishopMove(board, from, to);
            break;
        case 'queen':
            validMove = isValidQueenMove(board, from, to);
            break;
        case 'king':
            validMove = isValidKingMove(from, to);
            break;
    }
    
    if (!validMove) {
        return { success: false, message: '❌ Nước đi không hợp lệ cho loại quân này!' };
    }
    
    return { success: true, capturedPiece: targetPiece || undefined };
}

// Kiểm tra nước đi của tốt
function isValidPawnMove(board: Board, from: Position, to: Position, color: string): boolean {
    const direction = color === 'white' ? -1 : 1;
    const startRow = color === 'white' ? 6 : 1;
    const dRow = to.row - from.row;
    const dCol = Math.abs(to.col - from.col);
    
    // Đi thẳng 1 ô
    if (dCol === 0 && dRow === direction && !board[to.row][to.col]) {
        return true;
    }
    
    // Đi thẳng 2 ô từ vị trí ban đầu
    if (dCol === 0 && from.row === startRow && dRow === 2 * direction) {
        const middleRow = from.row + direction;
        if (!board[middleRow][from.col] && !board[to.row][to.col]) {
            return true;
        }
    }
    
    // Ăn chéo
    if (dCol === 1 && dRow === direction && board[to.row][to.col]) {
        return true;
    }
    
    return false;
}

// Kiểm tra nước đi của xe
function isValidRookMove(board: Board, from: Position, to: Position): boolean {
    if (from.row !== to.row && from.col !== to.col) return false;
    
    // Kiểm tra đường đi có bị chặn không
    if (from.row === to.row) {
        const start = Math.min(from.col, to.col) + 1;
        const end = Math.max(from.col, to.col);
        for (let col = start; col < end; col++) {
            if (board[from.row][col]) return false;
        }
    } else {
        const start = Math.min(from.row, to.row) + 1;
        const end = Math.max(from.row, to.row);
        for (let row = start; row < end; row++) {
            if (board[row][from.col]) return false;
        }
    }
    
    return true;
}

// Kiểm tra nước đi của mã
function isValidKnightMove(from: Position, to: Position): boolean {
    const dRow = Math.abs(to.row - from.row);
    const dCol = Math.abs(to.col - from.col);
    return (dRow === 2 && dCol === 1) || (dRow === 1 && dCol === 2);
}

// Kiểm tra nước đi của tượng
function isValidBishopMove(board: Board, from: Position, to: Position): boolean {
    const dRow = Math.abs(to.row - from.row);
    const dCol = Math.abs(to.col - from.col);
    
    if (dRow !== dCol) return false;
    
    // Kiểm tra đường đi có bị chặn không
    const rowDir = to.row > from.row ? 1 : -1;
    const colDir = to.col > from.col ? 1 : -1;
    
    let row = from.row + rowDir;
    let col = from.col + colDir;
    
    while (row !== to.row && col !== to.col) {
        if (board[row][col]) return false;
        row += rowDir;
        col += colDir;
    }
    
    return true;
}

// Kiểm tra nước đi của hậu
function isValidQueenMove(board: Board, from: Position, to: Position): boolean {
    return isValidRookMove(board, from, to) || isValidBishopMove(board, from, to);
}

// Kiểm tra nước đi của vua
function isValidKingMove(from: Position, to: Position): boolean {
    const dRow = Math.abs(to.row - from.row);
    const dCol = Math.abs(to.col - from.col);
    return dRow <= 1 && dCol <= 1;
}

/**
 * Thực hiện nước đi
 */
export function makeMove(fen: string, fromNotation: string, toNotation: string, currentTurn: string): MoveResult {
    const from = notationToPosition(fromNotation.toLowerCase());
    const to = notationToPosition(toNotation.toLowerCase());
    
    if (!from || !to) {
        return { success: false, message: '❌ Vị trí không hợp lệ! Sử dụng format: `a1` đến `h8`' };
    }
    
    const board = fenToBoard(fen);
    const validation = isValidMove(board, from, to, currentTurn);
    
    if (!validation.success) {
        return validation;
    }
    
    // Thực hiện di chuyển
    const piece = board[from.row][from.col];
    board[to.row][to.col] = piece;
    board[from.row][from.col] = null;
    
    // Phong cấp tốt
    const pieceType = getPieceType(piece);
    if (pieceType === 'pawn') {
        if ((currentTurn === 'white' && to.row === 0) || (currentTurn === 'black' && to.row === 7)) {
            board[to.row][to.col] = `${currentTurn}_queen`;
            validation.promotion = true;
        }
    }
    
    const nextTurn = currentTurn === 'white' ? 'black' : 'white';
    const newFen = boardToFen(board, nextTurn);
    
    // Kiểm tra chiếu và chiếu bí
    const checkResult = isInCheck(board, nextTurn);
    if (checkResult) {
        validation.isCheck = true;
        if (isCheckmate(board, nextTurn)) {
            validation.isCheckmate = true;
        }
    } else if (isStalemate(board, nextTurn)) {
        validation.isStalemate = true;
    }
    
    return {
        ...validation,
        success: true,
        board,
        fen: newFen
    };
}

/**
 * Tìm vị trí vua
 */
function findKing(board: Board, color: string): Position | null {
    const kingPiece = `${color}_king`;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            if (board[row][col] === kingPiece) {
                return { row, col };
            }
        }
    }
    return null;
}

/**
 * Kiểm tra một bên có đang bị chiếu không
 */
export function isInCheck(board: Board, color: string): boolean {
    const kingPos = findKing(board, color);
    if (!kingPos) return false;
    
    const opponentColor = color === 'white' ? 'black' : 'white';
    
    // Kiểm tra tất cả quân đối phương có thể ăn vua không
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (piece && getPieceColor(piece) === opponentColor) {
                const from = { row, col };
                const pieceType = getPieceType(piece);
                
                let canAttack = false;
                switch (pieceType) {
                    case 'pawn':
                        const direction = opponentColor === 'white' ? -1 : 1;
                        canAttack = Math.abs(kingPos.col - col) === 1 && kingPos.row - row === direction;
                        break;
                    case 'rook':
                        canAttack = isValidRookMove(board, from, kingPos);
                        break;
                    case 'knight':
                        canAttack = isValidKnightMove(from, kingPos);
                        break;
                    case 'bishop':
                        canAttack = isValidBishopMove(board, from, kingPos);
                        break;
                    case 'queen':
                        canAttack = isValidQueenMove(board, from, kingPos);
                        break;
                    case 'king':
                        canAttack = isValidKingMove(from, kingPos);
                        break;
                }
                
                if (canAttack) return true;
            }
        }
    }
    
    return false;
}

/**
 * Kiểm tra có nước đi hợp lệ nào không
 */
function hasLegalMoves(board: Board, color: string): boolean {
    for (let fromRow = 0; fromRow < 8; fromRow++) {
        for (let fromCol = 0; fromCol < 8; fromCol++) {
            const piece = board[fromRow][fromCol];
            if (piece && getPieceColor(piece) === color) {
                for (let toRow = 0; toRow < 8; toRow++) {
                    for (let toCol = 0; toCol < 8; toCol++) {
                        const from = { row: fromRow, col: fromCol };
                        const to = { row: toRow, col: toCol };
                        
                        const validation = isValidMove(board, from, to, color);
                        if (validation.success) {
                            // Thử nước đi và kiểm tra có còn bị chiếu không
                            const testBoard = board.map(row => [...row]);
                            testBoard[to.row][to.col] = testBoard[from.row][from.col];
                            testBoard[from.row][from.col] = null;
                            
                            if (!isInCheck(testBoard, color)) {
                                return true;
                            }
                        }
                    }
                }
            }
        }
    }
    return false;
}

/**
 * Kiểm tra chiếu bí
 */
export function isCheckmate(board: Board, color: string): boolean {
    return isInCheck(board, color) && !hasLegalMoves(board, color);
}

/**
 * Kiểm tra hết nước (pat)
 */
export function isStalemate(board: Board, color: string): boolean {
    return !isInCheck(board, color) && !hasLegalMoves(board, color);
}

/**
 * Render bàn cờ thành string để hiển thị trên Discord
 * Dùng hoàn toàn emoji để đảm bảo đều nhau
 */
export function renderBoard(fen: string, perspective: 'white' | 'black' = 'white'): string {
    const board = fenToBoard(fen);
    
    // Dùng emoji cho tất cả quân cờ - đảm bảo đều
    // Trắng: emoji sáng, Đen: emoji tối
    const PIECE_EMOJI: { [key: string]: string } = {
        'white_king': '👑', 'white_queen': '👸', 'white_rook': '🏰',
        'white_bishop': '⛪', 'white_knight': '🐴', 'white_pawn': '⚪',
        'black_king': '🤴', 'black_queen': '👿', 'black_rook': '🗼',
        'black_bishop': '🎩', 'black_knight': '🦄', 'black_pawn': '⚫'
    };
    
    // Ô trống
    const LIGHT_EMPTY = '🟨';
    const DARK_EMPTY = '🟫';
    
    let output = '';
    
    const rows = perspective === 'white' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
    const rowEmoji = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'];
    
    for (const rowIdx of rows) {
        const rowNum = 8 - rowIdx;
        const colIndices = perspective === 'white' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
        
        let rowStr = rowEmoji[rowNum - 1];
        
        for (const colIdx of colIndices) {
            const piece = board[rowIdx][colIdx];
            const isLight = (rowIdx + colIdx) % 2 === 0;
            
            if (piece) {
                rowStr += PIECE_EMOJI[piece] || '❓';
            } else {
                rowStr += isLight ? LIGHT_EMPTY : DARK_EMPTY;
            }
        }
        
        output += rowStr + '\n';
    }
    
    // Footer - tên cột với khoảng cách
    const colLabels = perspective === 'white' 
        ? '🔲🇦 🇧 🇨 🇩 🇪 🇫 🇬 🇭'
        : '🔲🇭 🇬 🇫 🇪 🇩 🇨 🇧 🇦';
    output += colLabels;
    
    // Chú thích
    output += '\n```';
    output += '\nTrắng: 👑Vua 👸Hậu 🏰Xe ⛪Tượng 🐴Mã ⚪Tốt';
    output += '\nĐen:   🤴Vua 👿Hậu 🗼Xe 🎩Tượng 🦄Mã ⚫Tốt';
    output += '\n```';
    
    return output;
}

/**
 * Lấy danh sách các nước đi hợp lệ cho một quân cờ
 */
export function getValidMoves(fen: string, notation: string): string[] {
    const pos = notationToPosition(notation.toLowerCase());
    if (!pos) return [];
    
    const board = fenToBoard(fen);
    const piece = board[pos.row][pos.col];
    if (!piece) return [];
    
    const color = getPieceColor(piece)!;
    const validMoves: string[] = [];
    
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const to = { row, col };
            const validation = isValidMove(board, pos, to, color);
            if (validation.success) {
                // Kiểm tra nước đi không để vua bị chiếu
                const testBoard = board.map(r => [...r]);
                testBoard[to.row][to.col] = testBoard[pos.row][pos.col];
                testBoard[pos.row][pos.col] = null;
                
                if (!isInCheck(testBoard, color)) {
                    validMoves.push(positionToNotation(to));
                }
            }
        }
    }
    
    return validMoves;
}
