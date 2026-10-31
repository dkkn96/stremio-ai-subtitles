import { AppError } from './errors.js';

// Original test dialogue: these fixtures are not an LLM-quality demonstration.
export const demoEnglish = `1
00:00:01,000 --> 00:00:03,500
Did you bring the keys?

2
00:00:04,000 --> 00:00:06,500
I thought you had them.

3
00:00:07,000 --> 00:00:09,800
Great. Now we're both locked out.

4
00:00:11,000 --> 00:00:13,500
Wait. The kitchen window is open.

5
00:00:15,000 --> 00:00:17,000
After you.

6
00:00:18,000 --> 00:00:20,500
How very kind of you.
`;

const hungarian = [
  'Elhoztad a kulcsokat?', 'Azt hittem, nálad vannak.',
  'Remek. Most mindketten kint rekedtünk.', 'Várj! Nyitva van a konyhaablak.',
  'Csak utánad.', 'Igazán kedves tőled.',
];

export const demoSource = {
  async list(_type, id) {
    return id === 'tt0000000' ? [{ id: 'original-demo', lang: 'eng', url: 'https://example.org/demo.srt', label: 'Original demo' }] : [];
  },
  async download() { return demoEnglish; },
};

export async function demoTranslator(cues) {
  const cuesText = demoEnglish;
  if (cues.some(cue => !hungarian[cue.id - 1] || !cuesText.includes(cue.text))) {
    throw new AppError('DEMO_ONLY', 'The demo only supports the included invented dialogue.');
  }
  return { cues: cues.map(cue => ({ id: cue.id, text: hungarian[cue.id - 1] })), usage: {} };
}
