"""Keep only literal document evidence, allowing typography/whitespace normalization.
No fuzzy matching, synonyms or inferred skill names. Stored quotes remain verbatim PDF text.
"""
import re
import unicodedata
from app.core.errors import ProviderError
from app.modules.schemas import Analysis, Evidence

PUNCTUATION = str.maketrans({'\u2018':"'",'\u2019':"'",'\u201c':'"','\u201d':'"',
    '\u2010':'-','\u2011':'-','\u2012':'-','\u2013':'-','\u2014':'-','\u2212':'-'})


def analysis_wire_schema():
    """Groq's decoder can emit overlong lists/blank strings then reject its own JSON.
    Keep structural typing upstream; apply presentation limits and full validation locally.
    """
    schema=Analysis.model_json_schema()
    def visit(value):
        if isinstance(value,dict):
            return {key:visit(item) for key,item in value.items() if key not in ('maxItems','minLength')}
        if isinstance(value,list): return [visit(item) for item in value]
        return value
    return visit(schema)


def clean_analysis_lists(payload):
    if not isinstance(payload,dict): return payload
    payload=dict(payload)
    for name,field in Analysis.model_json_schema()['properties'].items():
        value=payload.get(name)
        if field.get('type')!='array' or field.get('items',{}).get('type')!='string': continue
        if not isinstance(value,list) or not all(isinstance(item,str) for item in value): continue
        cleaned=[];seen=set()
        for item in value:
            item=item.strip()
            if not item or item.casefold() in seen: continue
            seen.add(item.casefold());cleaned.append(item)
        payload[name]=cleaned[:field.get('maxItems',len(cleaned))]
    return payload


def canonical(value: str):
    characters=[]
    spans=[]
    for index, char in enumerate(value):
        for normalized in unicodedata.normalize('NFKC',char).translate(PUNCTUATION).casefold():
            if normalized.isspace():
                if not characters: continue
                if characters[-1]==' ':
                    spans[-1]=(spans[-1][0],index+1)
                    continue
                normalized=' '
            characters.append(normalized)
            spans.append((index,index+1))
    if characters and characters[-1]==' ':
        characters.pop();spans.pop()
    return ''.join(characters), spans


def ground_analysis(result: Analysis, source: str) -> Analysis:
    text, spans=canonical(source)
    evidence=[]
    seen=set()
    for item in result.evidence:
        quote,_=canonical(item.quote)
        position=text.find(quote) if quote else -1
        if position<0: continue
        original=source[spans[position][0]:spans[position+len(quote)-1][1]]
        if len(original)>3000 or original in seen: continue
        seen.add(original)
        evidence.append(Evidence(quote=original,feedback=item.feedback))
    if not evidence:
        raise ProviderError('The AI feedback could not be grounded in the PDF text. Please retry processing.')
    skills=[]
    for item in result.skills:
        skill,_=canonical(item)
        if not skill or skill in {canonical(s)[0] for s in skills}: continue
        match=re.search(r'(?<!\w)'+re.escape(skill)+r'(?!\w)',text)
        if match:
            original=source[spans[match.start()][0]:spans[match.end()-1][1]]
            if len(original)<=3000: skills.append(original)
    return Analysis.model_validate({**result.model_dump(),'skills':skills,'evidence':[e.model_dump() for e in evidence]})
