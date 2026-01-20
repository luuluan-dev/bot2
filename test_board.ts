// Test renderBoard - dùng chữ cái thay vì Unicode chess
const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// Dùng regional indicator + nền màu
// Trắng: chữ trên nền trắng, Đen: chữ trên nền đen
const PIECE_EMOJI: { [key: string]: string } = {
    'white_king': '🇰', 'white_queen': '🇶', 'white_rook': '🇷',
    'white_bishop': '🇧', 'white_knight': '🇳', 'white_pawn': '🇵',
    'black_king': '👑', 'black_queen': '💎', 'black_rook': '🏰',
    'black_bishop': '⛪', 'black_knight': '🐴', 'black_pawn': '⬛'
};

const LIGHT_EMPTY = '🟨';
const DARK_EMPTY = '🟫';

const FEN_TO_PIECE: { [key: string]: string } = {
    'K': 'white_king', 'Q': 'white_queen', 'R': 'white_rook',
    'B': 'white_bishop', 'N': 'white_knight', 'P': 'white_pawn',
    'k': 'black_king', 'q': 'black_queen', 'r': 'black_rook',
    'b': 'black_bishop', 'n': 'black_knight', 'p': 'black_pawn'
};

function fenToBoard(fen: string): (string | null)[][] {
    const board: (string | null)[][] = [];
    const rows = fen.split(' ')[0].split('/');
    for (const row of rows) {
        const boardRow: (string | null)[] = [];
        for (const char of row) {
            if (/[1-8]/.test(char)) {
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

// Option 1: All emoji approach
function renderBoardEmoji(fen: string): string {
    const board = fenToBoard(fen);
    
    // Dùng emoji cho tất cả - đảm bảo đều
    const pieces: { [key: string]: string } = {
        'white_king': '👑', 'white_queen': '👸', 'white_rook': '🏰',
        'white_bishop': '⛪', 'white_knight': '🐴', 'white_pawn': '⚪',
        'black_king': '🤴', 'black_queen': '👿', 'black_rook': '🗼',
        'black_bishop': '🎩', 'black_knight': '🦄', 'black_pawn': '⚫'
    };
    
    let output = '';
    const rowEmoji = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'];
    
    for (let rowIdx = 0; rowIdx < 8; rowIdx++) {
        const rowNum = 8 - rowIdx;
        let rowStr = rowEmoji[rowNum - 1];
        
        for (let colIdx = 0; colIdx < 8; colIdx++) {
            const piece = board[rowIdx][colIdx];
            const isLight = (rowIdx + colIdx) % 2 === 0;
            
            if (piece) {
                rowStr += pieces[piece];
            } else {
                rowStr += isLight ? '🟨' : '🟫';
            }
        }
        output += rowStr + '\n';
    }
    output += '🔲🇦🇧🇨🇩🇪🇫🇬🇭';
    return output;
}

// Option 2: Code block (guaranteed equal)
function renderBoardASCII(fen: string): string {
    const board = fenToBoard(fen);
    
    const pieces: { [key: string]: string } = {
        'white_king': 'K', 'white_queen': 'Q', 'white_rook': 'R',
        'white_bishop': 'B', 'white_knight': 'N', 'white_pawn': 'P',
        'black_king': 'k', 'black_queen': 'q', 'black_rook': 'r',
        'black_bishop': 'b', 'black_knight': 'n', 'black_pawn': 'p'
    };
    
    let output = '```\n';
    output += '   A B C D E F G H\n';
    output += '  ┌─┬─┬─┬─┬─┬─┬─┬─┐\n';
    
    for (let rowIdx = 0; rowIdx < 8; rowIdx++) {
        const rowNum = 8 - rowIdx;
        let rowStr = `${rowNum} │`;
        
        for (let colIdx = 0; colIdx < 8; colIdx++) {
            const piece = board[rowIdx][colIdx];
            const isLight = (rowIdx + colIdx) % 2 === 0;
            
            if (piece) {
                rowStr += pieces[piece] + '│';
            } else {
                rowStr += (isLight ? ' ' : '·') + '│';
            }
        }
        output += rowStr + '\n';
        if (rowIdx < 7) {
            output += '  ├─┼─┼─┼─┼─┼─┼─┼─┤\n';
        }
    }
    output += '  └─┴─┴─┴─┴─┴─┴─┴─┘\n';
    output += '   A B C D E F G H\n';
    output += '```\n';
    output += '`K=Vua Q=Hậu R=Xe B=Tượng N=Mã P=Tốt`\n';
    output += '`HOA=Trắng thường=Đen`';
    return output;
}

console.log('=== Option 1: ALL EMOJI ===\n');
console.log(renderBoardEmoji(INITIAL_FEN));
console.log('\n\n=== Option 2: ASCII (ĐẢM BẢO ĐỀU) ===\n');
console.log(renderBoardASCII(INITIAL_FEN));
