// Simple Format Parser for Questions
export const parseSimpleFormat = (text) => {
    const questions = [];
    const questionBlocks = text.trim().split(/\n\n+/);

    questionBlocks.forEach((block) => {
        const lines = block.split('\n').map(l => l.trim()).filter(l => l);
        if (lines.length < 5) return;

        const firstLine = lines[0];
        const match = firstLine.match(/^(\d+)\.\s+(.+)$/);
        if (!match) return;

        const questionNumber = parseInt(match[1], 10);
        let questionText = match[2];

        // Extract difficulty
        let difficulty = 'MEDIUM';
        const diffMatch = questionText.match(/\[(EASY|MEDIUM|HARD)\]$/);
        if (diffMatch) {
            difficulty = diffMatch[1];
            questionText = questionText.replace(/\[(EASY|MEDIUM|HARD)\]$/, '').trim();
        }

        // Parse options
        const options = {};
        let correctAnswer = 'A';

        for (let i = 1; i <= 4; i++) {
            const optionLine = lines[i];
            const optionMatch = optionLine?.match(/^([A-D])\)\s*(.+)$/);
            if (optionMatch) {
                const key = optionMatch[1];
                let value = optionMatch[2];

                // Check for asterisk indicating correct answer
                if (value.endsWith('*')) {
                    correctAnswer = key;
                    value = value.slice(0, -1);
                }

                options[key] = value;
            }
        }

        questions.push({
            questionId: `Q${String(questionNumber).padStart(3, '0')}`,
            questionNumber,
            questionText,
            options,
            correctAnswer,
            marks: 1,
            difficulty
        });
    });

    return questions;
};