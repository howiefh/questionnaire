const readline = require('readline'),
fs = require('fs');

var questions = [], question, 
option, oindex;

const rl = readline.createInterface({
    input: fs.createReadStream('D:/qa.md')
});

function parseQuestionLine(line, type, realType) {
    var start = line.indexOf(' '),
    end = line.lastIndexOf(type),
    qid = line.substring(0, start),
    qtext = line.substring(start + 1, end),
    qtype = realType;
    if (qtype.startsWith('radio')) {
        return {
            id: qid,
            text: qtext,
            type: qtype,
            options: []
        };
    } else {
        return {
            id: qid,
            text: qtext,
            type: qtype
        };
    }
}

function parseOptionLine(line, oindex) {
    var otext = line.substring(2);
    return {
        id: '' + oindex,
        text: otext
    }
}

rl.on('line', (line) => {
    line = line.trim();
    if (line.length === 0 && question) {
        if (question) {
            questions.push(question);
        }
        question = null
    } else if (line.endsWith('[单选单行文本]')) {
        oindex = 0;
        question = parseQuestionLine(line, '[单选单行文本]', 'radio-text');
    } else if (line.endsWith('[单选]')) {
        oindex = 0;
        question = parseQuestionLine(line, '[单选]', 'radio');
    } else if (line.endsWith('[单行文本]')) {
        oindex = 0;
        question = parseQuestionLine(line, '[单行文本]', 'text');
    } else if (line.endsWith('[提示]')) {
        oindex = 0;
        question = parseQuestionLine(line, '[提示]', 'msg');
    } else if (line.startsWith('* ')) {
        oindex++;
        option = parseOptionLine(line, oindex);
        question.options.push(option);
    } else {
        question.default = line;
    }
});

rl.on('close', () => {
    var content = JSON.stringify(questions, null, 4);
    console.info(content);
    fs.writeFile(__dirname + '/config.txt', content, {flag: 'w+'}, function (err) {
        if(err) {
         console.error(err);
         } else {
            console.log('写入成功');
         }
     });
});