$(function() {
    $.ajax({
        url: 'config.jsonp',
        dataType: "jsonp",
        jsonpCallback: "initQuestionnaire"
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

function initQuestionnaire(json) {
    $('#questionsForm').questionnaire(json);
}