/**
 * jQuery Questionnaire v1.0.0
 * https://github.com/howiefh/questionnaire
 *
 * Licensed under the MIT.
 * https://github.com/howiefh/questionnaire/blob/master/LICENSE
 *
 * Author: Feng Hao <howiefh@gmail.com>
 */
(function ($) {
    'use strict';
    var DIRECT = '$$DIRECT$$';
    var OK = {error: false, msg: 'ok'},
    NOT_COMPLETED_ERR = {error: true, msg: '未完成'},
    REQUIRED_ERR = {error: true, msg: '有必答项未答'};

    if (!String.prototype.startsWith) {
        String.prototype.startsWith = function (searchString, position) {
            return this.substr(position || 0, searchString.length) === searchString;
        };
    }

    if (!String.prototype.endsWith) {
        String.prototype.endsWith = function (searchString, position) {
            if (!(position < this.length)) {
                position = this.length;
            } else {
                position |= 0; // round position
            }
            return this.substr(position - searchString.length, searchString.length) === searchString;
        };
    }

    var tplEngine = function (tpl, data) {
        var reg = /<%([^%>]+)?%>/g,
            regOut = /(^( )?(if|for|else|switch|case|break|{|}))(.*)?/g,
            match,
            code = 'var r=[];\n',
            cursor = 0;

        var add = function (line, js) {
            line = line.trim();
            js ? (code += line.match(regOut) ? line + '\n' : 'r.push(' + line + ');\n') :
                (code += line != '' ? 'r.push("' + line.replace(/"/g, '\\"') + '");\n' : '');
            return add;
        }
        while (match = reg.exec(tpl)) {
            add(tpl.slice(cursor, match.index))(match[1], true);
            cursor = match.index + match[0].length;
        }
        if (cursor === 0) {
            return tpl;
        } else {
            add(tpl.substr(cursor, tpl.length - cursor));
            code += 'return r.join("");';
            return new Function(code.replace(/[\r\t\n]/g, '')).apply(data);
        }
    };

    var Question = function (element, questionnaire, question, index) {
        this.id = question.id;
        this.index = index;
        this.questionnaire = questionnaire;
        this.element = element;
        this.question = question;
        this.type = question.type;
        this.required = question.required;
        this.end = !!question.end;
        this.visible = false;
        this.error = false;
        this.multipleRoutes = false;
        this.singleChoiceType = this.type.startsWith('radio');
        this.selectedOption = null;
        this.nextQuestion = null;

        this.firstIn = null;
        this.firstOut = null;

        if (this.type.startsWith('radio')) {
            this.element.find('input[type=radio]').on('change', function (that) {
                return function () {
                    var checked = that.element.find('input[type=radio]:checked'),
                        opt = checked.length ? {
                            id: checked.data('oid'),
                            data: checked.data('data'),
                            text: checked.val()
                        } : null;

                    that.selectedOption = opt;
                    that.questionnaire.update(that.index);
                };
            }(this));
        }
    };

    Question.prototype = {
        isVisible: function () {
            return this.visible;
        },

        findRoute: function (opt) {
            var route = this.firstOut,
                opt = opt ? opt : (this.selectedOption ? this.selectedOption.id : null);

            if (!opt) {
                return null;
            }

            while (route) {
                if (route.opt === opt) {
                    break;
                }
                route = route.tailLink;
            }
            return route;
        },

        resetHiddenFields: function () {
            if (!this.visible) {
                this.selectedOption = null;
                if (this.multipleRoutes) { // 又多个不同选项时才需要重置，其他情况 nextQuestion 是固定的.
                    this.nextQuestion = null;
                }
                this.element.find('input, select, textarea').each(function () {
                    switch (this.type.toLowerCase()) {
                        case 'text':
                        case 'password':
                        case 'textarea':
                        case 'hidden':
                            this.value = '';
                            break;

                        case 'radio':
                        case 'checkbox':
                            this.checked = false;
                            break;

                        case 'select-one':
                        case 'select-multi':
                            this.selectedIndex = -1;
                            break;

                        default:
                            throw new Error('Unsupported input type.');
                            break;
                    }
                });
            }
        },

        changeState: function (newState) {
            if (this.visible !== newState) {
                this.visible = newState;
                this.element[this.visible ? 'show' : 'hide']();
            }
        },

        getAnswer: function () {
            var answer, options = [],
                textEle, text;

            answer = {
                id: this.id,
                type: this.type
            };

            if (this.type.startsWith('radio')) {
                if (this.selectedOption) {
                    options.push(this.selectedOption);
                }

                if (options.length) {
                    answer.options = options;
                    this.hideError();
                } else {
                    this.showError();
                }
            }

            if (this.type.endsWith('text')) {
                textEle = this.element.find('input[type=text]');
                text = textEle.length ? textEle.val() : null;

                if (text) {
                    answer.text = text;
                }

                if (this.type === 'text') {
                    if (text) {
                        this.hideError();
                    } else {
                        this.showError();
                    }
                }
            }

            answer.error = this.error;

            return answer;
        },

        showError: function() {
            this.error = true;
            this.element.addClass('error').prepend('<div class="error-text">这是必填项</div>');
        },

        hideError: function() {
            this.error = false;
            this.element.removeClass('error').find('.error-text').remove();
        }
    };

    var Route = function (headVex, tailVex, headLink, tailLink, opt) {
        this.headVex = headVex;
        this.tailVex = tailVex;
        this.headLink = headLink;
        this.tailLink = tailLink;
        this.opt = opt;
    };

    var Questionnaire = function (element, options) {
        this.element = $(element);
        this.options = $.extend({}, $.fn.questionnaire.defaults, options);
        this.id = this.options.id;
        this.questions = [];

        this.init();
    }

    Questionnaire.prototype = {
        init: function () {
            var questionConfigs = this.options.questions,
                model = this.options.model,
                parent = this.element,
                questionEle,
                questionsContent,
                questionIdIndexMap = {},
                questions = this.questions,
                question,
                arcs = [], //所有的问题跳转弧
                i, len, questionConfig,
                j, len1, optionConfig,
                arc, h, t,
                route, headQ, tailQ,
                headVex, moreThanOneChoice = false;

            this.element.hide();

            if (!$.isArray(questionConfigs)) {
                throw new Error('Config error. Questions is not array');
            }

            for (i = 0, len = questionConfigs.length; i < len; i++) {
                questionConfig = questionConfigs[i];
                // 解析问题模板
                questionConfig.text = tplEngine(questionConfig.text, model);

                if (!questionConfig.end) {
                    if (!questionConfig.goto && i + 1 < len) { // 没有显示指定跳转问题时指定数组的下一个问题.
                        questionConfig.goto = questionConfigs[i + 1].id;
                    } else {
                        throw new Error('Config error. Can not parse question ' + questionConfig.id + '\'s goto attribute.');
                    }

                    if (questionConfig.type.startsWith('radio')) {
                        for (j = 0, len1 = questionConfig.options.length; j < len1; j++) {
                            optionConfig = questionConfig.options[j];
                            if (!optionConfig.goto) {
                                optionConfig.goto = questionConfig.goto;
                            }

                            arcs.push({
                                head: optionConfig.goto,
                                tail: questionConfig.id,
                                opt: optionConfig.id
                            });
                        }
                    } else {
                        arcs.push({
                            head: questionConfig.goto,
                            tail: questionConfig.id,
                            opt: DIRECT
                        });
                    }
                }

                questionIdIndexMap[questionConfig.id] = i;
            }

            // 渲染问题页面内容
            questionsContent = tplEngine(this.options.tpl, this.options.questions);
            parent.append(questionsContent);

            for (i = 0, len = questionConfigs.length; i < len; i++) { // 初始化问题节点
                questionConfig = questionConfigs[i];
                questionEle = parent.find('#' + questionConfig.id);
                if (questionEle.length === 1) {
                    question = new Question(questionEle, this, questionConfig, i);
                    questions.push(question);
                } else {
                    throw new Error('Can not find question ' + questionConfig.id + '\'s element.');
                }
            }

            for (i = 0, len = arcs.length; i < len; i++) { // 初始化弧
                arc = arcs[i],
                    h = questionIdIndexMap[arc.head],
                    t = questionIdIndexMap[arc.tail];
                if (h === undefined || t === undefined) {
                    throw new Error('Config error. Can not find question ' + arc.head + ' or ' + arc.tail + '.');
                }

                // tailQ --> headQ. tailQ 是起始点, headQ 是终止点
                headQ = questions[h],
                    tailQ = questions[t];
                // tailQ 的入边, headQ 的出边
                route = new Route(h, t, headQ.firstIn, tailQ.firstOut, arc.opt);
                headQ.firstIn = tailQ.firstOut = route;
            }

            for (i = 0, len = questions.length; i < len; i++) { // 初始化问题的 multipleRoutes 和 nextQuestion 属性
                question = questions[i];
                route = question.firstOut;
                headVex = route ? route.headVex : -1;
                moreThanOneChoice = false;

                if (question.singleChoiceType) {
                    while (route) {
                        if (route.headVex !== headVex) {
                            moreThanOneChoice = true;
                            break;
                        }
                        route = route.tailLink;
                    }
                }

                if (moreThanOneChoice) {
                    question.multipleRoutes = true;
                } else {
                    question.nextQuestion = headVex > -1 ? questions[headVex] : null;
                }
            }

            this.update();
        },

        update: function (start) {
            var questions = this.questions,
                selectedRoute,
                selectedNextQuestion,
                prevQuestion,
                currentQuestion,
                question,
                start = start || 0,
                i, len = questions.length;

            if (start >= len || start < 0) {
                return;
            }

            currentQuestion = questions[start];
            selectedRoute = currentQuestion.findRoute();
            selectedNextQuestion = selectedRoute ? questions[selectedRoute.headVex] : null;
            prevQuestion = null;
            question = currentQuestion.nextQuestion;

            currentQuestion.changeState(true);

            while (question) { // 先把原先显示的问题隐藏
                if (question.index === selectedNextQuestion.index) { // 和目前问题选项的对应下一个问题相同
                    break;
                }
                question.changeState(false);

                prevQuestion = question;
                question = question.nextQuestion;
                if (this.options.resetHiddenFields) {
                    prevQuestion.resetHiddenFields();
                }
            }

            question = currentQuestion.nextQuestion = selectedNextQuestion;

            while (question) { // 显示选择的问题分支
                question.changeState(true);

                if (question.multipleRoutes && !question.nextQuestion) { // 之前没有做选择并且有多个会跳转到不同问题的路径时跳出
                    break;
                }

                question = question.nextQuestion;
            }

            if (this.element.is(':hidden')) {
                this.element.show();
            }
        },

        collectAnswers: function () {
            var question = this.questions[0],
                prevQuestion = question,
                answers = [],
                answer,
                result = OK;

            while (question) {
                answer = question.getAnswer();
                if (answer) {
                    if (answer.error) {
                        result = REQUIRED_ERR;
                    }
                    answers.push(answer);
                } else {
                    result = REQUIRED_ERR;
                    break;
                }
                prevQuestion = question;
                question = question.nextQuestion;
            }

            if (!prevQuestion.end) {
                result = NOT_COMPLETED_ERR;
            }

            return {
                id: this.id,
                error: result.error,
                msg: result.msg,
                answers: answers
            };
        }
    };

    $.fn.questionnaire = function (option) {
        var args = Array.apply(null, arguments);
        args.shift();
        var internalReturn, callFunction = false;
        this.each(function () {
            var $this = $(this),
                instance = $this.data('questionnaire'),
                options = typeof option == 'object' && option;
            if (!instance) {
                $this.data('questionnaire', (instance = new Questionnaire(this, options)));
            }
            if (typeof option == 'string' && typeof instance[option] == 'function') {
                internalReturn = instance[option].apply(instance, args);
                callFunction = true;
                return false;
            }
        });

        if (callFunction) {
            return internalReturn;
        } else {
            return this;
        }
    };

    $.fn.questionnaire.defaults = {
        resetHiddenFields: true, // true | false
        tpl: '<% for(var i = 0; i < this.length; i++) { ' +
            'var question = this[i]; %>' +
            '<fieldset class="question" id="<% question.id %>" data-qid="<% question.id %>" data-index="<% i %>" style="display:none">' +
            '  <h5 class="question-text"><% question.text %></h5>' +
            '  <% if(question.type.indexOf("radio") === 0) { %>' +
            '  <div class="options">' +
            '    <% for(var j = 0; j < question.options.length; j++) { ' +
            '    var option = question.options[j]; %>' +
            '    <label class="radio-inline">' +
            '      <input type="radio" name="<% question.id %>" data-oid="<% option.id %>" data-data="<% option.data %>" value="<% option.text %>"><% option.text %>' +
            '    </label>' +
            '    <% } %>' +
            '  </div>' +
            '  <% } %>' +
            '  <% if(question.type.lastIndexOf("text") !== -1 && question.type.lastIndexOf("text") === question.type.length - 4) { %>' +
            '  <div class="form-group">' +
            '    <div class="col-sm-10">' +
            '      <input type="text" class="form-control" name="<% question.id %>">' +
            '    </div>' +
            '  </div>' +
            '  <% } %>' +
            '</fieldset>' +
            '<% } %>'
    };

})(jQuery);