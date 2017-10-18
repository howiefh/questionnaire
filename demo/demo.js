$(function() {
    $.getJSON('config.json', function(json) {
        $('#questionsForm').questionnaire(json);
    });

    $('#collectAnswers').click(function(){
        var answers = $('#questionsForm').questionnaire('collectAnswers');
        console.info(answers);
        alert(JSON.stringify(answers));
    })
})