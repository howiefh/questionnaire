$(function() {
    $.getJSON('config.json', function(json) {
        $('#questionsForm').questionnaire(json);
    });

    $('#questionsForm').on('q.change', function(){
        var answers = $('#questionsForm').questionnaire('collectAnswerTexts');
        $('#answers').text(answers);
    });

    $('#collectAnswers').click(function(){
        var answers = $('#questionsForm').questionnaire('collectAnswers');
        console.info(answers);
        alert(JSON.stringify(answers));
    })
})