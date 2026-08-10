class Calculator:
    def __init__(self):
        self.value = 0
    def add(self, n):
        self.value += n
    def subtract(self, n):
        self.value -= n
    def reset(self):
        self.value = 0
