"""把字幕文本转换成更适合 Kokoro 中文语音合成的“读法”。

Kokoro 的英文词典是小写的，全大写或驼峰写法的专有名词往往会被
逐字母拼读或读错，所以这里把它们换成拆开的小写单词或中文音译。
这些替换只影响语音，不影响屏幕上的字幕。
"""
import re

# 顺序很重要：长的、更具体的词放在前面。
SAY = [
    ("AlphaGo Zero", "阿尔法狗 zero"),
    ("AlphaGo", "阿尔法狗"),
    ("AlphaFold 2", "阿尔法 fold 2"),
    ("AlphaFold", "阿尔法 fold"),
    ("DeepSeek-R1", "deep seek R1"),
    ("ChatGPT", "查特GPT"),
    ("GPT-3.5", "GPT 3.5"),
    ("GPT-4o", "GPT 4o"),
    ("GPT-4", "GPT 4"),
    ("GPT-3", "GPT 3"),
    ("GPT-2", "GPT 2"),
    ("ENIAC", "埃尼阿克"),
    ("ELIZA", "伊莉莎"),
    ("DENDRAL", "丹德拉尔"),
    ("MYCIN", "麦辛"),
    ("XCON", "X con"),
    ("LISP", "lisp"),
    ("ImageNet", "image net"),
    ("AlexNet", "alex net"),
    ("ResNet", "res net"),
    ("word2vec", "word to vec"),
    ("DeepMind", "deep mind"),
    ("OpenAI", "open AI"),
    ("BERT", "bert"),
    ("DALL·E", "达利"),
    ("Midjourney", "mid journey"),
    ("Stable Diffusion", "stable diffusion"),
    ("Anthropic", "anthropic"),
    ("Claude", "克劳德"),
    ("Gemini", "杰米奈"),
    ("LLaMA", "拉玛"),
    ("Sora", "索拉"),
    ("Shakey", "shakey"),
    ("Transformer", "transformer"),
    ("Siri", "siri"),
    ("CASP", "卡斯普"),
    ("DEC", "D E C"),
    ("o1", "欧一"),
    ("Meta", "梅塔"),
    ("3.5比2.5", "三点五比二点五"),
    ("4比1", "四比一"),
    ("3比0", "三比零"),
]

# 这些符号在 Kokoro 的词表里没有，会产生 “unknown token”；
# 书名号、引号、间隔号直接去掉，括号和破折号换成逗号停顿。
_STRIP = str.maketrans({"《": "", "》": "", "“": "", "”": "", "·": "", "—": "，", "…": "", "（": "，", "）": "，"})


def to_speech(text: str) -> str:
    for src, dst in SAY:
        text = text.replace(src, dst)
    text = text.translate(_STRIP)
    text = re.sub(r"，{2,}", "，", text)
    return text.strip()
