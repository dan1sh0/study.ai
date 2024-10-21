# imports
import sys
import json
import whisper


def main():
    # read the data from input
    input_data = sys.stdin.read()
    params = json.loads(input_data)
    video_path = params['video_path']

    # transcription
    model = whisper.load_model('base')
    result = model.transcribe(video_path)
    transcription = result['text']

    # Output the transcription as JSON
    output = {
        'transcription': transcription
    }
    print(json.dumps(output))


if __name__ == '__main__':
    main()
