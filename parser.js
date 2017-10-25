const readline = require('readline'),
    fs = require('fs');

var questions = [],
    question,
    option, oindex,
    questionType = {
        "单选": "radio",
        "单行文本": "text",
        "多行文本": "textarea",
        "单选单行文本": "radio-text",
        "单选多行文本": "radio-textarea",
        "提示": "msg"
    },
    types = [];

for (var key in questionType) {
    types.push(questionType[key]);
}

const rl = readline.createInterface({
    input: fs.createReadStream('demo/config.txt')
});

function parseLine(line) {
    var reg = /\[([^\]]+)?\]/g, match, 
    attrs = [], attr, attrPair,
    prefix, text, index,
    type,
    i, len,
    option;

    while (match = reg.exec(line)) {
        attrs.push({
            index: match.index,
            text: match[1]
        });
    }

    if (attrs.length) {
        index = line.indexOf(' ');
        prefix = line.substring(0, index);
        text = line.substring(index + 1, attrs[0].index);

        type = attrs[attrs.length - 1].text;

        if (questionType[type]) {
            type = questionType[type];
        } else if (types.indexOf(type) === -1) {
            type = null;
        }
    } else if (line.startsWith('* ')) {
        index = line.indexOf(' ');
        prefix = line.substring(0, index);
        text = line.substring(index + 1);
    } else {
        text = line;
    }

    if (type) {
        oindex = 0;
        if (type.startsWith('radio')) {
            question = {
                id: prefix,
                text: text,
                type: type,
                options: []
            };
        } else {
            question = {
                id: prefix,
                text: text,
                type: type
            };
        }

        for (i = 0, len = attrs.length; i < len; i++) {
            attr = attrs[i];
            attrPair = attr.text.split(':');
            if (attrPair.length === 2) {
                question[attrPair[0]] = attrPair[1];
            }
        }
    } else if (prefix) {
        option = {
            id: '' + (++oindex),
            text: text
        }

        for (i = 0, len = attrs.length; i < len; i++) {
            attr = attrs[i];
            attrPair = attr.text.split(':');
            if (attrPair.length === 2) {
                option[attrPair[0]] = attrPair[1];
            }
        }

        question.options.push(option);
    } else {
        question.default = text;
    }
}

rl.on('line', (line) => {
    line = line.trim();
    if (line.length === 0 && question) {
        console.info('empty line: ', question);
        questions.push(question);
        question = null
    } else {
        console.info('parse: ', line);
        parseLine(line);
    }
});

rl.on('close', () => {
    var content = JSON.stringify(questions, null, 4);
    console.info(content);
    fs.writeFile(__dirname + '/out.txt', content, {
        flag: 'w+'
    }, function (err) {
        if (err) {
            console.error(err);
        } else {
            console.log('写入成功');
        }
    });
});