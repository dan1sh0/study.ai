# question_answer.py
import sys
import json
from transformers import pipeline


def answer_question(question, context):
    # Initialize the QA pipeline
    qa_pipeline = pipeline(
        "question-answering",
        model="bert-large-uncased-whole-word-masking-finetuned-squad",
        tokenizer="bert-large-uncased-whole-word-masking-finetuned-squad"
    )

    # Get the answer
    result = qa_pipeline(question=question, context=context)
    return result['answer']


if __name__ == "__main__":
    # Read JSON input from stdin
    input_str = sys.stdin.read()
    input_data = json.loads(input_str)
    question = input_data['question']
    context = input_data['context']

    # Get the answer
    answer = answer_question(question, context)

    # Output the answer as JSON
    output = {'answer': answer}
    print(json.dumps(output))
