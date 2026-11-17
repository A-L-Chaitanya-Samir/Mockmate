import pytest
from app.ai.evidence import ground_analysis
from app.ai.evidence import analysis_wire_schema, clean_analysis_lists
from app.core.errors import ProviderError
from app.modules.schemas import Analysis


def analysis(quotes,skills):
    return Analysis(score=70,skills=skills,strengths=['Clear skills.'],improvements=['Add verified outcomes.'],
        structure='Readable.',readability='Readable.',missing_information=[],role_relevance='No target role.',
        evidence=[{'quote':quote,'feedback':'Document evidence.'} for quote in quotes])


def test_pdf_line_breaks_case_ligatures_and_typography_preserve_verbatim_source():
    source='Built Python\n  APIs and processed ﬁles — reliably.'
    result=ground_analysis(analysis(['built python apis','processed files - reliably.'],['PYTHON','Python programming','Rust']),source)
    assert [item.quote for item in result.evidence]==['Built Python\n  APIs','processed ﬁles — reliably.']
    assert result.skills==['Python']
    assert all(item.quote in source for item in result.evidence)


def test_unsupported_quotes_are_not_saved_and_no_fuzzy_achievement_matching():
    result=ground_analysis(analysis(['Built Python APIs','Saved $1 million'],['Python','Java']), 'Built Python APIs for internal teams.')
    assert len(result.evidence)==1
    assert result.skills==['Python']
    with pytest.raises(ProviderError):
        ground_analysis(analysis(['Saved $1 million'],['Python']), 'Built Python APIs.')


def test_skills_require_whole_names_not_fragments_of_other_languages():
    result=ground_analysis(analysis(['Used JavaScript'],['Java','JavaScript']), 'Used JavaScript for testing.')
    assert result.skills==['JavaScript']


def test_provider_presentation_cleanup_keeps_contract_bounds_and_rejects_bad_scores():
    from pydantic import ValidationError
    payload=analysis(['Used Python'],['Python']).model_dump()
    payload['skills']=['Python',' python ','']+[f'Skill {i}' for i in range(50)]
    payload['strengths']=['Clear skills.',' ','Clear skills.']
    result=Analysis.model_validate(clean_analysis_lists(payload))
    assert len(result.skills)==30
    assert result.skills[0]=='Python'
    assert result.strengths==['Clear skills.']
    assert 'maxItems' not in analysis_wire_schema()['properties']['skills']
    assert Analysis.model_json_schema()['properties']['skills']['maxItems']==30
    payload['score']=101
    with pytest.raises(ValidationError): Analysis.model_validate(clean_analysis_lists(payload))
