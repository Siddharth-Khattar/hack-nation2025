from typing import Any, Dict
from app.schemas.schemas import Dataset, Relation

def similarity_relation_datasets(dataset_1: Dataset, dataset_2: Dataset) -> Relation:
    """Check if two datasets are related"""

    if dataset_1.vector.similarity(dataset_2.vector) > 0.5:
        return True
    else:
        return False


def check_create_relation(dataset_1: Dataset, dataset_2: Dataset) -> Relation:
    """Check if two datasets are related and create a relation"""
    return None 