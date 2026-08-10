def validate_input(data):
    """Validate the input data structure."""
    if not data:
        raise ValueError("Empty data")
    return True

class DataProcessor:
    def __init__(self, config):
        self.config = config
        self.results = []
    def run(self, dataset):
        for item in dataset:
            self.results.append(transform(item))
    def export(self, path):
        with open(path, 'w') as f:
            f.write(serialize(self.results))
