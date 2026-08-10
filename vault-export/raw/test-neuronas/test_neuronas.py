def process_data(input_file, output_file):
    """Process input data and write to output."""
    with open(input_file) as f:
        data = f.read()
    result = transform(data)
    with open(output_file, 'w') as f:
        f.write(result)

class ConfigManager:
    def __init__(self, path):
        self.path = path
        self.config = {}
    def load(self):
        with open(self.path) as f:
            self.config = parse(f.read())
    def save(self):
        with open(self.path, 'w') as f:
            f.write(serialize(self.config))
